// api/image.js - Proxy de imágenes con CORS para exportación en Canvas de CineZine
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

    // Permitir dominios de imágenes oficiales del proyecto
    const allowedHosts = ['image.tmdb.org', 'api.dicebear.com', 'images.unsplash.com'];
    if (!allowedHosts.includes(parsed.hostname.toLowerCase())) {
        return res.status(403).json({ error: 'Dominio de imagen no permitido' });
    }

    try {
        const upstream = await fetch(rawUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CineZine/1.0',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({ error: 'Error al obtener la imagen de origen' });
        }

        const contentType = upstream.headers.get('content-type') || 'image/jpeg';
        const buffer = await upstream.arrayBuffer();

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');
        return res.send(Buffer.from(buffer));
    } catch (err) {
        return res.status(502).json({ error: 'Fallo al procesar la imagen' });
    }
}
