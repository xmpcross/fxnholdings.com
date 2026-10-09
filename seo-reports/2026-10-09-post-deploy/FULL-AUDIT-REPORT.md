# FXN Holdings — post-deployment SEO audit

**Update:** Automated remediation has been deployed and verified. See [current remediation status](REMEDIATION.md); findings below describe the original audit baseline.

Assessed 9 October 2026 (Australia/Perth), against https://fxnholdings.com after deployment of asset version `20261010f`.

## Executive assessment

Deployment succeeded. The API service is active and its public health endpoint returns HTTP 200. Ten pre-deployment regression tests passed. The working tree was deployed; it includes uncommitted fixes and is not represented by the base commit alone. The previous static build remains in `.dist-old/`. See [deployment evidence](evidence/deployment.json).

No critical technical indexing blocker was found. All 19 sitemap URLs are live, indexable and self-canonical. The most important remaining work is content correctness and accountable expert review of the two tax/business guides. The article carousel also needs larger interactive targets.

Business type: corporate digital venture group with an informational blog. The site itself is not a retail checkout, local storefront or general-purpose publisher. Product, local-business and international storefront checklists are therefore not automatically applicable.

## Coverage and method

- Fresh live requests; previous audit/cache findings were not reused as evidence.
- Robots-respecting internal-link crawl, one-second delay, at most three redirects. It visited 23 URL forms representing 22 unique linked HTML pages, all within two links of the homepage. The slashless root is the duplicate URL form, not an additional page.
- Cross-checked all 24 generated HTML pages, including the unlinked confirmation and error documents. Nineteen indexable pages and five intentional noindex pages are accounted for.
- Inspected robots.txt, sitemap, RSS, redirects, status codes, raw HTML metadata, JSON-LD, image attributes and OG image dimensions.
- Fresh mobile Lighthouse tests on the homepage and UK VAT article; desktop/mobile browser checks, screenshots, menu and TOC interaction checks.
- Specialist review of content, GEO/search experience, schema/sitemap and performance/visual behavior. Spot-checked consequential article claims against primary sources.

## Confirmed priorities

| Priority | Finding | Recommended action |
|---|---|---|
| High | UK VAT guide states marketplace sellers with local stock must always maintain registration, omitting an available exemption | Correct the blanket claim and distinguish registration, approved exemption and import-VAT recovery; have the complete guide reviewed |
| High | US guide omits eligibility conditions for SS-4 Foreign/N/A and exemptions for foreign-entity BOI reporting | Qualify those passages and replace the old FinCEN guide link with current official guidance |
| High | No identifiable qualified reviewer for consequential legal/tax guides | Publish genuine reviewer identity, relevant credentials, review date and correction route after review occurs |
| Medium | Article carousel has 8×8px clickable dots with insufficient spacing | Increase hit areas to at least 24×24px, preferably 44×44px, preserving the small visual dots |
| Medium | Broad capability claims have limited first-hand case-study evidence | Add substantiated project stories with scope, dates and measured results where available |
| Low | Article dateModified always equals publication date; sitemap lastmod relies on git dirtiness/source-only history | Support actual substantive-update dates and stable sitemap timestamps before future revisions |

These are newly reported findings; the audit did not change the articles or carousel after the deployment.

### Content evidence

The VAT guide needs to acknowledge that qualifying overseas sellers making only zero-rated deemed supplies may apply for exemption from registration. [HMRC marketplace guidance](https://www.gov.uk/guidance/vat-and-overseas-goods-sold-to-customers-in-the-uk-using-online-marketplaces).

For SS-4 line 7b, lack of an SSN/ITIN alone is insufficient for the stated Foreign/N/A instruction; the responsible party must also be ineligible to obtain one. [IRS SS-4 instructions](https://www.irs.gov/instructions/iss4).

The US guide should preserve its correct domestic-entity exemption and qualify foreign reporting obligations for applicable exemptions, using current sources. [FinCEN BOI guidance](https://www.fincen.gov/boi).

This is an editorial spot check, not a comprehensive legal/tax compliance opinion. Detailed findings, live article URLs and review opportunities are in [CONTENT-REVIEW.md](CONTENT-REVIEW.md).

## Technical SEO and discovery

All 19 XML sitemap URLs return HTTP 200 without redirects and have self-referencing HTTPS canonicals. Robots.txt allows crawling and advertises the sitemap. Important text is delivered in the initial HTML. No missing indexable sitemap page or indexable orphan was found. HTTP, www and slashless /about each redirect to the canonical form in one hop. Invented routes return HTTP 404 rather than a soft-404 page.

Three one-post category pages are deliberately noindexed. The two-post Starting a Business category is indexable. `/contact/thanks/` and `/404.html` are also noindex and excluded from the sitemap. Direct `/404.html` returns 200, but unknown URLs correctly return 404; this is not a material indexing defect.

HTTPS, HSTS, nosniff, SAMEORIGIN, referrer and permissions policies were present. HTML uses `Cache-Control: no-transform`; CSS/JS are versioned. No CSP header was observed; a carefully tested CSP is optional security hardening, not a confirmed search blocker. This audit does not verify Cloudflare WAF rules or hard API rate limits.

## On-page, structured data and images

Titles and descriptions were present, with one H1 per checked template and working internal discovery. Short descriptive titles such as Blog, Privacy and Sitemap are not automatically defective because of character count. The two-post business category could gain a useful introductory explanation as the cluster grows; padding pages to an arbitrary minimum is not recommended.

JSON-LD parses throughout: homepage Organization/WebSite, breadcrumbs on other indexable pages and BlogPosting on all five articles. Founding year is consistently 2024. All inspected images have alt attributes; decorative card thumbnails correctly use empty alt text next to descriptive linked titles. All six OG images are valid 1200×630 assets. RSS contains five published articles. [Detailed schema/sitemap review](SCHEMA-SITEMAP.md).

## Performance and accessibility

| Mobile lab test | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|
| Homepage | 99 | 100 | 100 | 100 | 1.7 s | 0.001 | 0 ms |
| UK VAT article | 99 | 96 | 100 | 100 | 1.8 s | 0 | 0 ms |

These are single Lighthouse lab runs with simulated throttling. Lighthouse SEO 100 is a limited technical-check score, not proof of rankings or editorial correctness. Field INP and real-user Core Web Vitals were unavailable; TBT is not INP.

The mobile menu fills the viewport below the header, makes background content inert and closes using Escape. Article TOC links update the URL and scroll without JavaScript errors. Checked mobile/desktop pages had no horizontal overflow. The confirmed accessibility defect is the carousel target size. Cookie/chat controls remain visually above the open menu but are inert; hiding them is optional visual polish. [Full performance review and evidence](PERFORMANCE-VISUAL.md).

## AI search and automated score interpretation

The installed deterministic runner produced an **automated screening score of 83/100**, weighted as below. This is a tool heuristic, not a Google score or an endorsed final measure of site quality.

| Category | Weight | Raw tool score |
|---|---:|---:|
| Technical | 22% | 92 |
| Content | 23% | 64 |
| On-page | 20% | 100 |
| Schema | 10% | 92 |
| Performance | 10% | 91 |
| AI search readiness | 10% | 55 |
| Images | 5% | 82 |

Manual review rejected several automated severity labels: missing llms.txt is not critical; there is no established 134–167-word answer requirement; server-rendered text is demonstrably present; empty alt text is appropriate for decorative linked thumbnails; missing WebPage schema or IndexNow is not an indexing blocker. The runner also misclassified the site as a general publisher and its performance score was heuristic; use the measured Lighthouse results above. The unreviewed output is preserved for transparency in [automated-summary-unreviewed.json](evidence/automated-summary-unreviewed.json).

Google says existing SEO fundamentals apply to AI features and no special AI text files or schema are required. Treat llms.txt as an optional experiment, not an urgent fix. [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features). Prioritize reliable, attributable, first-hand information and appropriate review instead of arbitrary length targets. [Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

## Data limits and follow-up

Google Search Console, GA4, PageSpeed/CrUX credentials and paid backlink integrations were unavailable. Indexability was checked, but actual Google index coverage, ranking, traffic and field CWV cannot be certified. A Common Crawl bulk-graph lookup was attempted but stopped after the bounded audit window; no authority or backlink counts were inferred. No paid APIs, real contact emails or AI chat calls were used. No ownership or performance claims for the 14 portfolio sites were independently certified. Rich Results Test and comprehensive manual accessibility testing remain separate checks.

See [ACTION-PLAN.md](ACTION-PLAN.md) for the next work. A PDF version can be generated from these reviewed findings on request.
