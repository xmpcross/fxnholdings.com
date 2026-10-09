// Shared helpers for the Worker handlers in worker/.

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

// Requests must come from the site itself (or a workers.dev preview).
export function allowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin form posts from some browsers omit it
  try {
    const host = new URL(origin).hostname;
    return host === "fxnholdings.com" || host === "www.fxnholdings.com" || host.endsWith(".workers.dev") || host.endsWith(".pages.dev") || host === "localhost" || host === "127.0.0.1";
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

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
