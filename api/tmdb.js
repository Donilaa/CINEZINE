// Puente seguro para ocultar TMDB_BEARER_TOKEN en Vercel Serverless
// En el panel de Vercel -> Settings -> Environment Variables, crea:
//   Nombre: TMDB_BEARER_TOKEN
//   Valor:  (tu Read Access Token v4 de TMDb)

const ALLOWED_ENDPOINT_RE = /^\/(movie\/\d+|tv\/\d+(\/season\/\d+(\/episode\/\d+)?)?|search\/(movie|tv|multi)|discover\/(movie|tv))(\?[^\s#]*)?$/;
const DEFAULT_ORIGIN_RE = /^https:\/\/(cinezine(-[a-z0-9-]+)?\.vercel\.app|donilaa\.github\.io)$/i;

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    const allowedEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || origin === 'null';
    const isAllowedOrigin = origin && (
        allowedEnv.includes(origin) ||
        (allowedEnv.length === 0 && DEFAULT_ORIGIN_RE.test(origin)) ||
        isLocal
    );

    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
        res.setHeader('Vary', 'Origin');
    } else if (!origin) {
        res.setHeader('Access-Control-Allow-Origin', 'https://cinezine.vercel.app');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const rawToken = process.env.TMDB_BEARER_TOKEN;
    const token = rawToken ? rawToken.trim().replace(/^["']+|["';]+$/g, '') : '';
    if (!token) {
        return res.status(500).json({ error: 'Falta configurar TMDB_BEARER_TOKEN en Vercel' });
    }

    const endpoint = String((req.query && req.query.endpoint) || '');
    if (
        !endpoint ||
        endpoint.length > 300 ||
        endpoint.includes('..') ||
        endpoint.includes('//') ||
        !ALLOWED_ENDPOINT_RE.test(endpoint)
    ) {
        return res.status(400).json({ error: 'Consulta no permitida' });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
        const isBearerJwt = token.startsWith('eyJ') || token.length > 60;
        const sep = endpoint.includes('?') ? '&' : '?';
        const targetUrl = isBearerJwt
            ? `https://api.themoviedb.org/3${endpoint}`
            : `https://api.themoviedb.org/3${endpoint}${sep}api_key=${encodeURIComponent(token)}`;
        const headers = { 'Content-Type': 'application/json;charset=utf-8' };
        if (isBearerJwt) headers['Authorization'] = `Bearer ${token}`;

        const upstream = await fetch(targetUrl, {
            method: 'GET',
            headers,
            signal: ctrl.signal
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: 'Error consultando TMDb' });
        }

        const data = await upstream.json();
        // Caché en borde de Vercel por 1 hora (acelera la web y ahorra cuota de TMDb)
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(data);
    } catch (err) {
        const isTimeout = err && err.name === 'AbortError';
        return res.status(isTimeout ? 504 : 502).json({ error: isTimeout ? 'Tiempo de espera agotado en TMDb' : 'Fallo de red con TMDb' });
    } finally {
        clearTimeout(timer);
    }
}
