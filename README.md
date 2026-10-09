# fxnholdings.com

Website for FXN Holdings (Perth, WA · ABN 53 274 423 748), served by a **Cloudflare Worker with static assets** (`fxnholdings-com`), deployed by Cloudflare Workers Builds when a branch is pushed to GitHub. Canonical address: `https://fxnholdings.com` (no `www`).

## Layout

| Path | What it is |
| --- | --- |
| `_src/pages/*.html` | Page content, each with a `<!--meta {...} -->` block (title, description, path, nav) |
| `_src/partials/` | Shared header, footer (incl. cookie notice and chat widget) and logo |
| `_src/build.py` | Builds the site into `dist/` |
| `static/` | Copied into `dist/` as is: `assets/` (CSS, JS, self-hosted Font Awesome), `fonts/`, `img/`, icons, `robots.txt`, `sitemap.xml`, `_headers` |
| `worker/index.js` | Worker entry: `/api/*` goes to the handlers, everything else to the static assets in `dist/` |
| `worker/contact.js`, `worker/chat.js` | `POST /api/contact` and `POST /api/chat` |
| `worker/lib/` | `http.js` helpers and `email.js` (Google Workspace SMTP) |
| `wrangler.jsonc` | Worker config: build command, assets directory, routing |

`dist/` is generated and not committed.

## Build and preview

```bash
python3 _src/build.py      # writes dist/
```

Bump `VERSION` in `_src/build.py` whenever CSS or JS changes, so browsers fetch the new files.

## Deploying

Workers Builds runs `npx wrangler deploy` on push; `wrangler.jsonc` runs the site build (`python3 _src/build.py`) and uploads `dist/` with the Worker. Check a build locally without credentials:

```bash
npm install
npx wrangler deploy --dry-run     # builds, bundles and validates
npx wrangler dev                  # local server at http://localhost:8787
```

Variables and secrets (Cloudflare dashboard → Workers & Pages → fxnholdings-com → Settings → Variables and Secrets). `keep_vars` in `wrangler.jsonc` keeps dashboard variables across deploys:

| Name | Type | Purpose |
| --- | --- | --- |
| `SMTP_USER` | text | Workspace mailbox that sends the notifications, e.g. `website@fxnholdings.com` |
| `SMTP_PASS` | secret | App Password for that mailbox |
| `SMTP_HOST` | text, optional | default `smtp.gmail.com` |
| `SMTP_PORT` | text, optional | default `465` (implicit TLS); `587` uses STARTTLS |
| `CONTACT_TO` | text, optional | default `contact@fxnholdings.com` |
| `MAIL_FROM` | text, optional | default `SMTP_USER`; must be that mailbox or one of its aliases |
| `ANTHROPIC_API_KEY` | secret | Website assistant. Without it the chat shows a "use the contact form" message |
| `CHAT_MODEL` | text, optional | default `claude-haiku-5-5` |

## Email (contact form and assistant enquiries)

Both endpoints email the team through Google Workspace SMTP from the Worker over TLS (Cloudflare blocks port 25, and its outbound IPs aren't fixed, so the IP-based Workspace relay can't be used). Messages go to `CONTACT_TO` with Reply-To set to the visitor.

Set up the sending mailbox once:

1. In Google Admin, allow 2-Step Verification and App Passwords for the user (Security → Authentication).
2. Sign in as the mailbox, turn on 2-Step Verification, then create an App Password (Google Account → Security → App passwords).
3. Put the mailbox in `SMTP_USER` and the App Password in `SMTP_PASS`.

## Website assistant (AI chat)

`worker/chat.js` answers visitors with Claude through the Anthropic SDK (`@anthropic-ai/sdk`, pinned in `package.json`). It answers only from the facts in `KNOWLEDGE` in that file (keep them in step with the site copy) and can email an enquiry, with the chat transcript, to the team.

- Create a dedicated API key with a monthly spend limit in the Anthropic Console.
- For a hard per-visitor limit, add a Cloudflare WAF rate-limiting rule on `/api/*`; the function's own limit is best effort.
- To show a WhatsApp link in the chat panel, put the number (with country code) in `data-whatsapp` on the `.chat` element in `_src/partials/footer.html`.
- The Privacy Policy (`#ai-assistant`), Cookie Policy and Terms (section 8) describe the assistant; update them if its behaviour changes.

## DNS

`www.fxnholdings.com` has no DNS record. Add a proxied `www` record in Cloudflare and a redirect rule from `www` to `https://fxnholdings.com`.
