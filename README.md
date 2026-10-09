# fxnholdings.com

Static site for FXN Holdings (Perth, WA · ABN 53 274 423 748), hosted on Netlify behind Cloudflare. Canonical address: `https://fxnholdings.com` (no `www`).

- Page content lives in `_src/pages/*.html`; the shared header, footer and logo are in `_src/partials/`.
- Styles: `assets/site.css`. Behaviour (menu, reveal, hero steps, contact form, cookie notice, chat widget): `assets/site.js`.
- Font Awesome Free 6.7.2 is self-hosted in `assets/vendor/fontawesome/` (no third-party CDNs, so the site loads everywhere).
- Rebuild the HTML at the site root after editing anything in `_src/`, and bump `VERSION` in `_src/build.py` when CSS or JS changes:

```bash
python3 _src/build.py
```

## Forms

Both forms post to Netlify Forms and are registered through `netlify-forms.html`:

- `contact`: the contact page form.
- `chat-enquiry`: enquiries handed over by the website assistant (name, email, company, type, summary and the chat transcript).

Set email notifications for both forms in Netlify → Site configuration → Forms → Form notifications, sending to contact@fxnholdings.com.

## Website assistant (AI chat)

`netlify/functions/chat.mjs` is a Netlify Function served at `/api/chat`. It answers visitors with Claude through the Anthropic SDK (`@anthropic-ai/sdk`, pinned in `package.json`) and can hand an enquiry to the team through the `chat-enquiry` form.

Netlify environment variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | API key for the assistant. Without it the widget shows a "use the contact form" message. |
| `CHAT_MODEL` | no | Model ID; defaults to `claude-haiku-5-5`. |

Before going live:

1. Create a dedicated API key for this site and set a monthly spend limit for it in the Anthropic Console. The function's per-visitor rate limit is best effort only.
2. Keep the facts in `KNOWLEDGE` inside `chat.mjs` in step with the site copy; the assistant answers only from them.
3. To show a WhatsApp link in the chat panel, put the number (with country code) in `data-whatsapp` on the `.chat` element in `_src/partials/footer.html`.

The Privacy Policy (`#ai-assistant`), Cookie Policy and Terms (section 8) describe the assistant; update them if its behaviour changes.

## DNS

`www.fxnholdings.com` currently has no DNS record. Add a proxied `www` CNAME in Cloudflare and a redirect rule from `www` to `https://fxnholdings.com`.
