// API server for fxnholdings.com on this host (systemd: fxnholdings-api.service).
//
// nginx serves the static site from dist/ and proxies /api/* here:
//   POST /api/contact  contact form       (worker/contact.js)
//   POST /api/chat     website assistant  (worker/chat.js)
//
// The handlers are the same ones the Cloudflare Worker used; they take a Web
// Request and an env object and return a Web Response.
//
// Environment (.env.local, loaded by the unit):
//   API_PORT            default 4330 (listens on 127.0.0.1 only)
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, CONTACT_TO   see worker/lib/email.js
//   ANTHROPIC_API_KEY, CHAT_MODEL                                       see worker/chat.js
import http from "node:http";
import { Readable } from "node:stream";
import { onRequestPost as contact } from "../worker/contact.js";
import { onRequestPost as chat } from "../worker/chat.js";
import { MAX_BODY } from "../worker/lib/http.js";

const PORT = Number(process.env.API_PORT || 4330);
const routes = { "/api/contact": contact, "/api/chat": chat };

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const path = (req.url || "/").split("?")[0].replace(/\/$/, "");
  if (path === "/api/health") return send(res, req.method === "GET" ? 200 : 405, req.method === "GET" ? { ok: true } : { error: "Method not allowed" });
  const handler = routes[path];
  if (!handler) return send(res, 404, { error: "Not found" });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  // Read the body with a size cap.
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) return send(res, 413, { error: "Request too large" });
      chunks.push(chunk);
    }
  } catch {
    return send(res, 400, { error: "Invalid request" });
  }

  let request;
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "fxnholdings.com";
    if (!["http", "https"].includes(proto)) throw new TypeError("Invalid protocol");
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
    request = new Request(`${proto}://${host}${req.url}`, { method: "POST", headers, body: Buffer.concat(chunks) });
  } catch {
    return send(res, 400, { error: "Invalid request" });
  }

  try {
    const response = await handler({ request, env: process.env });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch (error) {
    console.error(`api: ${path} failed:`, error);
    send(res, 500, { error: "Something went wrong. Please try again." });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`fxnholdings api listening on 127.0.0.1:${server.address().port}`));
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
