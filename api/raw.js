// Vercel serverless function: fetch an arbitrary public URL server-side and
// return its HTML + timing, so the browser can read a site it otherwise can't
// (CORS). Kept dependency-free (Node 18+ global fetch / AbortController).

const MAX_BYTES = 500 * 1024; // 500 KB cap
const TIMEOUT_MS = 8000;

// Block obvious SSRF targets: localhost, link-local, private ranges, metadata IP.
function isBlockedHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, ""); // strip ipv6 brackets
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
  if (h === "169.254.169.254") return true; // cloud metadata
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=86400");

  let raw = (req.query && req.query.url) || "";
  if (Array.isArray(raw)) raw = raw[0];
  raw = String(raw || "").trim();
  if (!raw) return res.status(400).json({ ok: false, error: "missing ?url" });
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;

  let target;
  try {
    target = new URL(raw);
  } catch {
    return res.status(400).json({ ok: false, error: "invalid url" });
  }
  if (!/^https?:$/.test(target.protocol))
    return res.status(400).json({ ok: false, error: "only http(s) urls" });
  if (isBlockedHost(target.hostname))
    return res.status(403).json({ ok: false, error: "host not allowed" });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(target.toString(), {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; TerrariumBot/1.0; +https://github.com/Ravdesigns/terrarium)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const ms = Date.now() - t0;
    const ctype = r.headers.get("content-type") || "";
    // read up to the cap
    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    let html = "";
    let bytes = 0;
    if (reader) {
      const dec = new TextDecoder("utf-8", { fatal: false });
      while (bytes < MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        html += dec.decode(value, { stream: true });
      }
      try { await reader.cancel(); } catch {}
    } else {
      html = (await r.text()).slice(0, MAX_BYTES);
      bytes = html.length;
    }
    clearTimeout(timer);
    return res.status(200).json({
      ok: true,
      finalUrl: r.url || target.toString(),
      https: (r.url || target.toString()).startsWith("https:"),
      status: r.status,
      contentType: ctype,
      ms,
      bytes,
      html,
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e && e.name === "AbortError";
    return res.status(200).json({
      ok: false,
      error: aborted ? "timed out" : "could not reach site",
      finalUrl: target.toString(),
    });
  }
}
