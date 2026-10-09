// Website assistant for fxnholdings.com.
//
// POST /api/chat  { messages: [{ role: "user" | "assistant", content: string }, ...] }
//   -> 200 { reply: string, enquirySent?: boolean }
//
// The browser keeps the transcript and sends it each turn as plain text, so no
// thinking blocks are ever replayed across requests. Within one request the
// model may call `submit_enquiry`, which posts the visitor's details to the
// Netlify form "chat-enquiry" (emailed to the team by Netlify).
//
// Environment (Netlify site settings):
//   ANTHROPIC_API_KEY  required
//   CHAT_MODEL         optional, defaults to claude-haiku-5-5
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.CHAT_MODEL || "claude-haiku-5-5";
const MAX_TURNS = 20; // messages kept from the transcript
const MAX_CHARS = 1500; // per visitor message
const MAX_TOOL_ROUNDS = 2;
const ALLOWED_ORIGINS = new Set(["https://fxnholdings.com", "https://www.fxnholdings.com"]);

const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });

// Best-effort per-visitor limit (per function instance). Pair it with a monthly
// spend limit on the API key in the Anthropic Console.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

// Facts the assistant may use. Keep in sync with the website copy.
const KNOWLEDGE = `
ABOUT FXN HOLDINGS
- FXN Holdings is a digital venture group based in Perth, Western Australia, founded in 2024. Registered business name: FXN Holdings, ABN 53 274 423 748. Postal address: PO Box 500, West Perth WA 6872, Australia. Email: contact@fxnholdings.com.
- What it does: finds gaps in markets, then builds and launches websites and platforms to fill them. Tagline: "Find the gap. Build. Launch."
- Five kinds of platform: e-commerce (online stores), travel & booking, content & publishing, price comparison & deals, free online tools.
- Approach: open-source foundations and reusable templates to keep costs down; each platform is set up for the market it serves (privacy, consumer, advertising and tax rules, local currency and language where they matter).
- Operating model: Explore (research demand, competitors, partner programs), Build (current frameworks, open source, own templates), Launch (set up for a specific region), Grow (measure, improve, reinvest).

LIVE WEBSITES (14)
- originfacts.com: travel & booking. Facts about places worth visiting, plus news and guides on flights, hotels, airlines and airports.
- nxt.deals: price comparison & deals. Verified deals, coupon codes and price comparison.
- nxtdiscount.com: price comparison & deals. Promo codes and discounted products.
- nxt.bargains: price comparison & deals. Side-by-side product comparisons, reviews and deals.
- nxtsmarthome.com.au: content & publishing (Australia). Smart home buying guides for Australian homes.
- nxtsmart.homes: content & publishing. Smart home guides, device reviews and how-tos.
- bestlooking.skin: content & publishing. Skincare reviews and guides.
- ohmnook.com: content & publishing. Home office and work-from-home tech guides by region.
- solostack.au: content & publishing (Australia). Tech stacks, reviews and AI automation guides for solo operators.
- furfunshop.com: e-commerce. Toys, beds, treats and care for dogs and cats.
- furryfriendfacts.com: e-commerce. Smart gadgets for pets.
- mysecure.homes: e-commerce. Smart home security products.
- nxtvitality.com: e-commerce. Supplements and wellness products.
- fxnseo.com: free online tools. Free browser-based SEO tools, no sign-up.

TECHNOLOGY
- Content and comparison sites run on Next.js and React with a shared headless CMS; some content sites use Payload CMS; online stores run on hosted store platforms or WordPress/WooCommerce.
- Build stack mentioned on the site: Next.js, React, Tailwind CSS, daisyUI, Strapi, Shopify, WooCommerce, n8n, Docker, Hetzner, Vercel.
- AI: FXN Holdings believes in AI built with regulation. AI helps draft and enrich content such as product titles and descriptions; a person reviews AI-assisted content before anything is published.

WORKING WITH FXN HOLDINGS
- Open to: partnerships, suppliers and brands, affiliate and advertising networks, developers, founders and new opportunities.
- Services described on the site: opportunity research, platform build & launch, local setup & compliance, growth & monetisation.
- Sponsored content and affiliate links are always disclosed.
- Contact: the contact form at fxnholdings.com/contact/ or contact@fxnholdings.com.

PAGES
- Home: fxnholdings.com/ · About: /about/ · What We Do: /services/ · Assets (all websites): /portfolio/ · Technology & AI: /technology/ · Contact: /contact/ · Privacy Policy: /privacy/ · Terms: /terms/ · Cookie Policy: /cookies/
`.trim();

const SYSTEM = `You are the website assistant for FXN Holdings, answering visitors on fxnholdings.com. The team is often offline, so you are usually the first point of contact.

Answer only from the facts below. If something isn't covered (prices, rates, traffic or revenue figures, timelines, partnership terms, whether a specific deal will be accepted), say you don't have that information and offer to pass the question to the team. Never invent facts, numbers, clients or commitments, and don't give legal, financial or tax advice. You are an AI assistant, not a person; say so if asked.

Keep replies short and friendly: two to four sentences, plain text, no markdown headings or tables. You may link to pages on the site by their path. Reply in the visitor's language.

When a visitor wants to work with FXN Holdings, asks for something only the team can answer, or asks to be contacted: collect their name, email address and a one- or two-sentence summary of what they need (company is optional), confirm the details with them, then call submit_enquiry. After it succeeds, tell them the team will reply by email. Never call submit_enquiry without a real email address the visitor gave you.

<facts>
${KNOWLEDGE}
</facts>`;

const TOOLS = [
  {
    name: "submit_enquiry",
    description:
      "Send the visitor's enquiry to the FXN Holdings team by email. Use only after the visitor has given their name, email and what they need, and has confirmed the details.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Visitor's full name" },
        email: { type: "string", description: "Visitor's email address" },
        company: { type: "string", description: "Company name, or empty string if not given" },
        enquiry_type: {
          type: "string",
          enum: ["Partnership", "Supplier / brand", "Affiliate & advertising", "New opportunity", "General enquiry"],
        },
        summary: { type: "string", description: "One or two sentences on what the visitor needs" },
      },
      required: ["name", "email", "company", "enquiry_type", "summary"],
      additionalProperties: false,
    },
  },
];

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

function cleanTranscript(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS).trim() }))
    .filter((m) => m.content)
    .slice(-MAX_TURNS);
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

async function submitEnquiry(input, transcript, siteUrl) {
  const email = String(input.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "The email address looks invalid. Ask the visitor to check it." };
  }
  const body = new URLSearchParams({
    "form-name": "chat-enquiry",
    subject: "[fxnholdings.com] Enquiry from the website assistant",
    name: String(input.name || "").slice(0, 200),
    email: email.slice(0, 200),
    company: String(input.company || "").slice(0, 200),
    enquiry_type: String(input.enquiry_type || ""),
    summary: String(input.summary || "").slice(0, 2000),
    transcript: transcript.map((m) => `${m.role === "user" ? "Visitor" : "Assistant"}: ${m.content}`).join("\n\n").slice(0, 8000),
  });
  const res = await fetch(new URL("/netlify-forms.html", siteUrl), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  return res.ok
    ? { ok: true, message: "Enquiry sent to the team." }
    : { ok: false, message: "Sending failed. Ask the visitor to use the contact form at /contact/ or email contact@fxnholdings.com." };
}

export default async (req, context) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin) && !origin.endsWith(".netlify.app")) {
    return json(403, { error: "Forbidden" });
  }
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "Assistant not configured" });
  if (rateLimited(context?.ip || req.headers.get("x-nf-client-connection-ip") || "unknown")) {
    return json(429, { error: "busy", reply: "You've sent a lot of messages in a short time. Please wait a few minutes, or email contact@fxnholdings.com." });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const transcript = cleanTranscript(payload?.messages);
  if (!transcript) return json(400, { error: "Send a conversation that ends with a visitor message." });

  const siteUrl = context?.site?.url || process.env.URL || "https://fxnholdings.com";
  const messages = transcript.map((m) => ({ role: m.role, content: m.content }));
  let enquirySent = false;

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: TOOLS,
        messages,
      });

      if (response.stop_reason === "refusal") {
        return json(200, { reply: "Sorry, I can't help with that. For anything else, ask away or email contact@fxnholdings.com." });
      }

      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolUses = response.content.filter((b) => b.type === "tool_use");

      if (response.stop_reason !== "tool_use" || !toolUses.length || round === MAX_TOOL_ROUNDS) {
        return json(200, {
          reply: text || "Sorry, I didn't catch that. Could you rephrase?",
          enquirySent,
        });
      }

      // Keep the full assistant turn (including any thinking blocks) for the tool round-trip.
      messages.push({ role: "assistant", content: response.content });
      const results = [];
      for (const tool of toolUses) {
        let result;
        if (tool.name === "submit_enquiry") {
          result = await submitEnquiry(tool.input, transcript, siteUrl);
          if (result.ok) enquirySent = true;
        } else {
          result = { ok: false, message: `Unknown tool ${tool.name}` };
        }
        results.push({ type: "tool_result", tool_use_id: tool.id, content: result.message, is_error: !result.ok });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json(429, { error: "busy", reply: "I'm getting a lot of questions right now. Please try again in a minute, or email contact@fxnholdings.com." });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("chat: Anthropic authentication failed - check ANTHROPIC_API_KEY");
    } else if (error instanceof Anthropic.APIError) {
      console.error(`chat: Anthropic API error ${error.status}: ${error.message}`);
    } else {
      console.error("chat: unexpected error", error);
    }
    return json(502, { error: "unavailable", reply: "The assistant is unavailable right now. Please use the contact form at /contact/ or email contact@fxnholdings.com." });
  }
  return json(500, { error: "unavailable" });
};

export const config = { path: "/api/chat" };
