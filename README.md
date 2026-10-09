# fxnholdings.com

Website for FXN Holdings (Perth, WA · ABN 53 274 423 748), served on this host by **nginx from `dist/`**, with a Node API (`fxnholdings-api.service`) on `127.0.0.1:4330`. A Cloudflare Worker configuration is also maintained for alternative hosting. Canonical address: `https://fxnholdings.com` (no `www`).

## Layout

| Path | What it is |
| --- | --- |
| `_src/pages/*.html` | Page content, each with a `<!--meta {...} -->` block (title, description, path, nav) |
| `_src/partials/` | Shared header, footer (incl. cookie notice and chat widget) and logo |
| `_src/build.py` | Builds the site into `dist/`, or `BUILD_OUT` when set |
| `server/api.mjs` | Node API behind nginx; `GET /api/health` checks process readiness |
| `deploy.sh` | Host deployment, API health check and static-site rollback |
| `static/` | Copied into `dist/` as is: `assets/` (CSS, JS, self-hosted Font Awesome), `fonts/`, `img/`, icons, `robots.txt`, `_headers` (`sitemap.xml` is generated) |
| `worker/index.js` | Worker entry: `/api/*` goes to the handlers, everything else to the static assets in `dist/` |
| `worker/contact.js`, `worker/chat.js` | `POST /api/contact` and `POST /api/chat` |
| `worker/lib/` | `http.js` helpers and `email.js` (Google Workspace SMTP) |
| `wrangler.jsonc` | Worker config: build command, assets directory, routing |

`dist/` is generated and not committed.

## Insights (posts)

Posts are Markdown files in `_src/posts/`; the file name is the URL (`_src/posts/my-post.md` → `/insights/my-post/`). Each starts with:

```markdown
---
title: Post title
date: 2026-10-09
category: technology-ai
summary: One or two sentences for listings and search results.
draft: true
---
```

The body supports `##`/`###` headings, paragraphs, `-` and `1.` lists, `>` quotes, `---` rules, `**bold**`, `*italic*`, `` `code` `` and `[links](/path/)`. Categories are defined in `_src/insights.py`: `technology-ai`, `company-news`, `start-a-business`, `market-gaps`. Front matter uses plain, unquoted values; put comments on separate lines.

The build creates `/insights/`, a page per category, a page per post, `/insights/feed.xml` (RSS) and adds published posts to `sitemap.xml`. Drafts are left out of the live build; `python3 _src/build.py --drafts` includes them, marked "Draft", for previews.

For a substantive article correction, add optional `updated: YYYY-MM-DD` front matter with the actual update date. It controls the visible updated date and `dateModified`; `date` and RSS publication dates stay unchanged. Update dates cannot precede publication or be in the future. Sitemap `lastmod` uses trusted Git dates including shared rendering dependencies; dates are omitted when local changes or untracked sources make that history uncertain, rather than substituting each build's date.

## Build and preview

```bash
BUILD_OUT=/tmp/fxnholdings-preview PYTHONDONTWRITEBYTECODE=1 python3 _src/build.py
python3 _src/build.py --drafts   # writes .dist-preview/, includes draft posts
```

`dist/` is the live nginx document root on this host. Use a separate `BUILD_OUT` for checks; use `./deploy.sh` to publish. The default build replaces `dist/`.

Bump `VERSION` in `_src/build.py` whenever CSS or JS changes, so browsers fetch the new files.

## Deploying

For the current nginx/Node host:

```bash
./deploy.sh          # deploy the working tree
./deploy.sh --pull   # first pull with --ff-only
```

Deployment builds into `.dist-build/`, swaps it into `dist/`, restarts the API service, and requires `GET /api/health` to return 200. A failed restart or health check exits nonzero and restores the previous static site. `.dist-old/` remains as the previous static build after success. This does not roll back API source or installed dependencies; inspect the service logs if API startup fails. Deployments are serialised with `flock`.

The systemd unit loads `.env.local`. Keep it private and out of git. For isolated API development, use a free `API_PORT` and explicitly supply the required environment. `npm test` uses isolated processes and no live email/AI credentials.

The alternative Cloudflare path is `npx wrangler deploy` (also `npm run deploy`). `wrangler.jsonc` builds and uploads static assets with the Worker. On this live host, set `BUILD_OUT` and `--assets` together for an isolated dry-run:

```bash
BUILD_OUT=/tmp/fxnholdings-worker-check npx wrangler deploy --dry-run --assets /tmp/fxnholdings-worker-check
```

For Worker hosting, configure variables and secrets in its Cloudflare settings. `keep_vars` preserves dashboard variables. For Node hosting, configure them through the service environment.

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

Both endpoints use Google Workspace SMTP over TLS. Node uses nodemailer and supports the IP-authenticated Workspace relay via `SMTP_HOST=smtp-relay.gmail.com` without login credentials. The Worker uses TLS sockets and requires `SMTP_USER`/`SMTP_PASS` because its outbound IPs are not fixed. Messages go to `CONTACT_TO` with Reply-To set to the visitor.

Set up the sending mailbox once:

1. In Google Admin, allow 2-Step Verification and App Passwords for the user (Security → Authentication).
2. Sign in as the mailbox, turn on 2-Step Verification, then create an App Password (Google Account → Security → App passwords).
3. Put the mailbox in `SMTP_USER` and the App Password in `SMTP_PASS`.

## Website assistant (AI chat)

`worker/chat.js` answers visitors with Claude through the Anthropic SDK (`@anthropic-ai/sdk`, pinned in `package.json`). It answers only from the facts in `KNOWLEDGE` in that file (keep them in step with the site copy) and can email an enquiry, with the chat transcript, to the team.

- Create a dedicated API key with a monthly spend limit in the Anthropic Console.
- Origin checks accept the production, www and preview site origins, plus same-origin localhost/Workers/Pages previews. API request bodies are capped at 64 KiB.
- For a hard per-visitor limit, add a Cloudflare WAF rate-limiting rule on `/api/*`; the function's own limit is best effort.
- To show a WhatsApp link in the chat panel, put the number (with country code) in `data-whatsapp` on the `.chat` element in `_src/partials/footer.html`.
- The Privacy Policy (`#ai-assistant`), Cookie Policy and Terms (section 8) describe the assistant; update them if its behaviour changes.

## DNS

The canonical host is `fxnholdings.com`. Keep DNS and redirects for `www` aligned with the current hosting configuration.
