// Contact form endpoint: POST /api/contact
//
// Accepts JSON (from site.js) or a regular form post (no-JS fallback) with
// name, email, company, reason, message and the honeypot field bot-field.
// Emails the enquiry to the team through Google Workspace SMTP; see lib/email.js.
import { json, allowedOrigin, clientIp, rateLimited, isEmail } from "./lib/http.js";
import { sendEmail } from "./lib/email.js";

const LIMITS = { name: 200, email: 200, company: 200, reason: 100, message: 5000 };

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return { data: await request.json(), html: false };
  const form = await request.formData();
  return { data: Object.fromEntries(form), html: true };
}

export async function onRequestPost({ request, env }) {
  if (!allowedOrigin(request)) return json(403, { error: "Forbidden" });
  if (rateLimited(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
    return json(429, { error: "Too many messages. Please wait a few minutes and try again." });
  }

  let body;
  try {
    body = await readBody(request);
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const d = body.data || {};
  const done = () =>
    body.html ? Response.redirect(new URL("/contact/?sent=1#contact-form", request.url).toString(), 303) : json(200, { ok: true });

  // Bots fill the hidden field; pretend success so they don't retry.
  if (d["bot-field"]) return done();

  const f = Object.fromEntries(Object.entries(LIMITS).map(([k, max]) => [k, String(d[k] || "").trim().slice(0, max)]));
  if (!f.name || !f.email || !f.message) return json(400, { error: "Please add your name, email and message." });
  if (!isEmail(f.email)) return json(400, { error: "Please enter a valid email address." });

  const sent = await sendEmail(env, {
    subject: `[fxnholdings.com] ${f.reason || "Enquiry"} from ${f.name}`,
    replyTo: f.email,
    text: [
      "New message from the fxnholdings.com contact form",
      "",
      `Name:     ${f.name}`,
      `Email:    ${f.email}`,
      `Company:  ${f.company || "-"}`,
      `Enquiry:  ${f.reason || "-"}`,
      "",
      f.message,
    ].join("\n"),
  });
  if (!sent.ok) {
    return json(502, { error: "Something went wrong sending your message. Please try again." });
  }
  return done();
}

