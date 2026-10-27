// Puente seguro para ocultar TMDB_BEARER_TOKEN en Vercel Serverless
// En el panel de Vercel -> Settings -> Environment Variables, crea:
//   Nombre: TMDB_BEARER_TOKEN
//   Valor:  (tu Read Access Token v4 de TMDb)

const ALLOWED_ENDPOINT_RE = /^\/(movie\/\d+|search\/movie|discover\/movie)(\?[^\s#]*)?$/;

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    const allowedEnv = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) || origin === 'null';

    if (origin && (allowedEnv.length === 0 || allowedEnv.includes(origin) || isLocal)) {
        res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const token = process.env.TMDB_BEARER_TOKEN;
    if (!token) {
        return res.status(500).json({ error: 'Falta configurar TMDB_BEARER_TOKEN en Vercel' });
    }

    const endpoint = String((req.query && req.query.endpoint) || '');
    if (!endpoint || !ALLOWED_ENDPOINT_RE.test(endpoint)) {
        return res.status(400).json({ error: 'Consulta no permitida' });
    }

    try {
        const upstream = await fetch(`https://api.themoviedb.org/3${endpoint}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json;charset=utf-8'
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: 'Error consultando TMDb' });
        }

        const data = await upstream.json();
        // Caché en borde de Vercel por 1 hora (acelera la web y ahorra cuota de TMDb)
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json(data);
    } catch (err) {
        return res.status(502).json({ error: 'Fallo de red con TMDb' });
    }
}
