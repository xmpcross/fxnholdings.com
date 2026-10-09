// Cloudflare Worker for fxnholdings.com.
//
// Static pages are served from dist/ by Workers static assets. Only /api/* runs
// this script (see run_worker_first in wrangler.jsonc):
//   POST /api/contact  contact form       (worker/contact.js)
//   POST /api/chat     website assistant  (worker/chat.js)
import { onRequestPost as contact } from "./contact.js";
import { onRequestPost as chat } from "./chat.js";
import { json } from "./lib/http.js";

const routes = { "/api/contact": contact, "/api/chat": chat };

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const handler = routes[pathname.replace(/\/$/, "")];
    if (handler) {
      if (request.method !== "POST") return json(405, { error: "Method not allowed" });
      return handler({ request, env });
    }
    if (pathname.startsWith("/api/")) return json(404, { error: "Not found" });
    return env.ASSETS.fetch(request);
  },
};
