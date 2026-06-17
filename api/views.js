// A simple shared visit counter, stored as one Blob. Approximate by design
// (read-modify-write, no locks), fine for social proof, not accounting.
// The blob is written with no CDN caching and read fresh so the count moves.

import { put, list } from '@vercel/blob';

const PATH = 'meta/views.json';

async function readCount() {
  try {
    const { blobs } = await list({ prefix: PATH, limit: 1 });
    if (!blobs.length) return 0;
    const r = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j.count) || 0;
  } catch { return 0; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'POST') {
      const count = (await readCount()) + 1;
      await put(PATH, JSON.stringify({ count }), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'application/json', cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true, count });
    }
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, count: await readCount() });
  } catch {
    return res.status(200).json({ ok: false, count: 0 });
  }
}
