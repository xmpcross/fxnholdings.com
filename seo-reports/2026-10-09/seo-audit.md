# fxnholdings.com SEO audit, 9 October 2026

Scope: the whole site (20 pages, built by `_src/build.py`). fxnholdings.com is a B2B / professional-services site, so the audit covers technical SEO, on-page, entity and structured data, site structure (internal links, topic clusters) and answer-box readiness. Local, app-store, marketplace, podcast and voice search do not apply.

Method: every built page parsed for title, description, H1/H2, links, images, JSON-LD and robots; live checks of redirects, status codes, headers, robots.txt and sitemap; Lighthouse 12 (mobile) on the home page and a post. Google PageSpeed Insights was over its daily quota, so Lighthouse ran on this server. Raw Lighthouse results are in `lighthouse/`.

## Scorecard

| Area | Before | After |
| --- | --- | --- |
| Technical (HTTPS, redirects, 404, robots, sitemap, compression) | Good | Good; sitemap dates now real |
| Mobile performance, post page (Lighthouse) | 93, LCP 3.1 s | 99, LCP 2.0 s |
| Mobile performance, home page | 98, LCP 2.0 s | 98+ (icon download cut by ~330 KB) |
| Accessibility (Lighthouse) | 94–95 | 100 |
| On-page (titles, H1, alt text, canonical, OG/Twitter) | Good | Good; long post descriptions fixed |
| Entity / structured data | Organization + BlogPosting, no `sameAs` | `sameAs` to the ABN register entry |
| Internal linking to posts | Only from the listing and footer | Home page "Latest from the blog" block |
| Thin pages | 3 one-post category pages indexable | noindex until they have 2 posts |
| Privacy claims vs page code | Cloudflare injected an analytics beacon and email obfuscation | Both stopped (`Cache-Control: no-transform`) |

## Findings and fixes

All fixes are in git on `main` unless noted. Server config changes are noted separately because they are not in the repo.

1. **Slow mobile LCP on posts (3.1 s).** Phones downloaded the 1600 px featured image. Fixed with 800 px WebP variants and `srcset`/`sizes` (commit 28e0973). `_src/featured_images.py` now writes the 800 px variant for new posts.
2. **Accessibility.** The chat button had no accessible name on mobile, and the logo link's `aria-label` did not contain its visible tagline. Both fixed (28e0973).
3. **Entity signal.** Organization JSON-LD gained `sameAs` pointing at the public ABN register entry, which shows FXN Holdings (28e0973).
4. **Sitemap `lastmod`.** Every URL carried the build date. Now each URL uses the last commit of its source file, and listing pages use their newest post (28e0973).
5. **Cloudflare page rewriting** (server config, live since 9 Oct). Cloudflare Web Analytics injected `beacon.min.js`, contradicting the privacy and cookie policies ("no analytics"), and Email Obfuscation replaced the contact address with "[email protected]" for crawlers. `add_header Cache-Control "no-transform" always;` in `/etc/nginx/snippets/fxnholdings-site.conf` stops both; verified on `/`, `/contact/` and a post.
6. **Menu label vs page title.** The menu said "Blog" while the page said "Insights". The listing page, breadcrumbs, buttons, RSS feed and HTML sitemap now say Blog; the URL stays `/insights/` so no links break (349616e).
7. **No internal links to posts.** The home page now shows the three newest posts (349616e).
8. **Thin category pages.** Category pages are noindex and left out of `sitemap.xml` until they have two posts (349616e). Sitemap: 19 → 16 URLs.
9. **Truncated descriptions.** Two posts had 165–168 character descriptions. Posts accept an optional `description:` (search snippet only); both now ≤155 characters (349616e).
10. **Icon weight.** Font Awesome loaded ~350 KB for 45 icons. A subset (`_src/subset_icons.py`) brings it to ~16 KB; the build falls back to the full kit if a page uses an icon missing from the subset (8275b75).

Earlier the same day (link audit): "Assets" renamed "Our Websites" to match its page, footer order aligned with the menu, dead social links removed, empty Insights pages kept out of the index until posts were published.

## Open items

- **Founding date.** The site says founded 2024 (home page and JSON-LD); the ABN register shows the ABN active from 20 July 2023. Confirm which is right.
- **Social profiles.** Add real Facebook / X / WhatsApp URLs to the footer and to Organization `sameAs` when they exist.
- **Search Console.** Submit `https://fxnholdings.com/sitemap.xml` and request indexing of the posts.
- **Content depth.** Three posts, one per category. Category pages index automatically from their second post.
- **Not recommended:** FAQ schema for rich results (Google limits FAQ rich results to authoritative government and health sites since 2023).

## Re-running

```bash
cd /opt/projects/fxnholdings.com
python3 _src/build.py                     # live build; prints sitemap URL count
/opt/scripts/fxnholdings/.venv/bin/python _src/subset_icons.py   # after adding icons
# Lighthouse (mobile) against the live site:
CHROME_PATH=/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome \
  npx -y lighthouse@12 https://fxnholdings.com/ --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,seo,best-practices
```

Preview every change at https://preview.fxnholdings.com before `./deploy.sh`.
