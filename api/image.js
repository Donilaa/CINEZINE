// api/image.js - Proxy seguro de imágenes con CORS para exportación en Canvas de CineZine
const ALLOWED_IMAGE_HOSTS = new Set([
    'image.tmdb.org',
    'images.weserv.nl',
    'api.dicebear.com',
    'secure.gravatar.com',
    'lh3.googleusercontent.com',
    'firebasestorage.googleapis.com'
]);

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/svg+xml'
]);

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

function isHostAllowed(hostname) {
    if (ALLOWED_IMAGE_HOSTS.has(hostname)) return true;
    // Permitir subdominios de almacenamiento de Firebase (ej: cinezine-5c4c5.firebasestorage.app)
    if (hostname.endsWith('.firebasestorage.app')) return true;
    return false;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const rawUrl = String((req.query && req.query.url) || '').trim();
    if (!rawUrl) {
        return res.status(400).json({ error: 'Falta parámetro url' });
    }

    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch {
        return res.status(400).json({ error: 'URL inválida' });
    }

    // Permitir exclusivamente HTTPS y solo dominios autorizados en la lista blanca
    const hostname = parsed.hostname.toLowerCase();
    if (parsed.protocol !== 'https:' || !isHostAllowed(hostname)) {
        return res.status(403).json({ error: 'Host o protocolo no permitido' });
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    try {
        const upstream = await fetch(rawUrl, {
            redirect: 'error', // Prevenir redirecciones SSRF
            signal: ctrl.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CineZine/1.0',
                'Accept': 'image/avif,image/webp,image/apng,image/png,image/jpeg,image/*;q=0.8'
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: 'Error al obtener la imagen de origen' });
        }

        const rawContentType = (upstream.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        if (!ALLOWED_MIME_TYPES.has(rawContentType)) {
            return res.status(415).json({ error: 'Tipo de archivo no permitido' });
        }

        const buffer = await upstream.arrayBuffer();
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
            return res.status(413).json({ error: 'La imagen excede el tamaño máximo permitido' });
        }

        res.setHeader('Content-Type', rawContentType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
        return res.send(Buffer.from(buffer));
    } catch (err) {
        const isTimeout = err && err.name === 'AbortError';
        return res.status(isTimeout ? 504 : 502).json({ error: isTimeout ? 'Tiempo de espera agotado al descargar imagen' : 'Fallo al procesar la imagen' });
    } finally {
        clearTimeout(timer);
    }
}
