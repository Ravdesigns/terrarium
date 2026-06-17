// The shared garden: every plant anyone grows is recorded here (one Blob per
// host, so re-planting a site just refreshes it — no write races). GET returns
// the most recent plants; POST records one. Only compact, public site metadata
// is stored — never the fetched HTML, never anything personal.

import { put, list } from '@vercel/blob';

const MAX_ITEMS = 60;
// low-false-positive guard for a public, displayed list (extend as needed)
const BAD = /(porn|xvideos|xhamster|\bxxx\b|n[i1]gger|f[a4]ggot)/i;

function sanitizeHost(h) {
  h = String(h || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/^www\./, '');
  if (!/^[a-z0-9.-]{2,80}$/.test(h)) return '';
  if (!h.includes('.')) return '';                 // must look like a domain
  if (h === 'localhost' || h.endsWith('.local')) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return ''; // no raw IPs
  return h;
}
const num = (v, lo, hi) => { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : lo; };
const str = (s, n) => String(s || '').replace(/[\u0000-\u001F\u007F]/g, '').slice(0, n);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: 'garden/', limit: 1000 });
      const recent = blobs
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
        .slice(0, MAX_ITEMS);
      const items = (await Promise.all(recent.map(async (b) => {
        try { const r = await fetch(b.url); return r.ok ? await r.json() : null; }
        catch { return null; }
      }))).filter(Boolean);
      res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=120');
      return res.status(200).json({ ok: true, count: items.length, items });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (!body || typeof body !== 'object') {
        const raw = await new Promise((resolve) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => resolve(d)); });
        try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
      }
      const host = sanitizeHost(body.host);
      if (!host) return res.status(400).json({ ok: false, error: 'bad host' });
      if (BAD.test(host)) return res.status(403).json({ ok: false, error: 'rejected' });

      const colors = Array.isArray(body.colors) ? body.colors
        .filter((c) => c && typeof c.hex === 'string' && /^#[0-9a-f]{6}$/i.test(c.hex))
        .slice(0, 12)
        .map((c) => ({ hex: c.hex.toLowerCase(), count: num(c.count, 1, 1e6) })) : [];
      const families = Array.isArray(body.families) ? body.families.slice(0, 6).map((f) => str(f, 40)) : [];

      const record = {
        host,
        title: str(body.title, 90),
        colors,
        families,
        fontClass: ['serif', 'sans', 'mono'].includes(body.fontClass) ? body.fontClass : 'sans',
        tagCount: num(body.tagCount, 0, 5e6),
        linkCount: num(body.linkCount, 0, 5e6),
        imgCount: num(body.imgCount, 0, 5e6),
        scriptCount: num(body.scriptCount, 0, 5e6),
        https: !!body.https,
        ms: num(body.ms, 0, 120000),
        bytes: num(body.bytes, 0, 5e7),
        ts: Date.now(),
      };

      await put('garden/' + host + '.json', JSON.stringify(record), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json',
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (e) {
    return res.status(200).json({ ok: false, error: 'garden unavailable' });
  }
}
