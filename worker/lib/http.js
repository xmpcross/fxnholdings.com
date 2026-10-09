// Shared helpers for the Worker handlers in worker/.

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Allow our public sites and same-origin previews, not other tenants' previews.
export function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts from some browsers omit it
  try {
    const source = new URL(origin);
    if (["https://fxnholdings.com", "https://www.fxnholdings.com", "https://preview.fxnholdings.com"].includes(source.origin)) return true;
    const target = new URL(request.url);
    return source.origin === target.origin && (
      (source.protocol === "https:" && (source.hostname.endsWith(".workers.dev") || source.hostname.endsWith(".pages.dev"))) ||
      (["http:", "https:"].includes(source.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(source.hostname))
    );
  } catch {
    return false;
  }
}

export const clientIp = (request) =>
  request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";

// Best-effort limit per visitor within one Worker isolate. For a hard limit add a
// Cloudflare WAF rate-limiting rule on /api/*.
const buckets = new Map();
export function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const recent = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.clear();
  return recent.length > max;
}

export const isEmail = (s) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(s || "").trim());

export const MAX_BODY = 64 * 1024;

export async function readLimitedBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) {
        await reader.cancel();
        throw new RangeError("Request too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
