# Structured data, sitemap and discovery audit

Fresh HTTPS responses fetched 2026-10-09 after deployment. Evidence: `evidence/schema-crawl.json`. Examined 19 sitemap URLs, three linked noindex category URLs, the generated 24 HTML files, robots.txt, RSS, and all six unique Open Graph images.

## Result

No high-priority or currently blocking structured-data/sitemap fault found. All 19 sitemap URLs return 200 without redirects, are HTTPS, self-canonical and indexable. XML is valid; robots.txt allows crawling and references the correct sitemap. No indexable generated page is missing from the sitemap or orphaned from crawled internal navigation. RSS is valid with five published articles and live canonical links.

JSON-LD parses throughout. Homepage has Organization and WebSite; foundingDate is the user-confirmed 2024. All 18 other indexable pages carry correctly ordered BreadcrumbList data. All five articles also carry BlogPosting with headline, description, publication/modification dates, organization author with URL, publisher/logo, absolute images, language and mainEntityOfPage. No retired rich-result type detected. Markup is delivered in initial HTML. All crawl-visible img elements have alt attributes. All six unique OG assets return valid 1200 x 630 images, matching their declared dimensions.

Intentional exclusions: `/insights/company-news/`, `/insights/market-gaps/`, `/insights/technology-ai/` are thin one-post categories deliberately noindexed and omitted from XML; `/insights/start-a-business/` contains two posts and is indexed/included. `/contact/thanks/` and `/404.html` are appropriately noindex and absent from XML. An invented URL returns actual HTTP 404 with noindex. Direct `/404.html` itself returns 200 but is noindex, which is not a material crawl defect.

## Low-priority maintenance tasks

1. **Support truthful article modification dates before future revisions.** `_src/insights.py:399` always copies publication date into `dateModified`. Today all five posts were published on 2026-10-09, so no proven stale live date exists. Once an article is substantively edited, the generator will retain its old modification date. Add an explicit optional updated date or trustworthy persisted source modification date; preserve original publication date. Google treats these as recommended article metadata: [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article).
2. **Make sitemap lastmod stable across unchanged deployments.** All 19 live entries currently have 2026-10-09. Equal dates alone are not a bug: this is a same-day site launch. However `_src/build.py:224-234` returns today's date for any uncommitted source and bases committed dates on source files alone; redeploying unchanged dirty files tomorrow changes dates despite unchanged content, while shared-template changes may be missed. Track actual significant content changes or omit uncertain dates. Google uses lastmod when consistently/verifiably accurate, and advises reflecting significant updates: [Sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Optional enhancements, not defects

- Add stable organization `@id` references for publisher consistency, and optional AboutPage/ContactPage schema if useful. These are not required for indexation and no rich-result lift should be promised.
- Article schema uses two wide-image variants. Google's recommendation for multiple aspect ratios can be considered later; existing images are substantial, crawlable and valid.

## Limitations

Local parsing and required/recommended-field inspection are not a completed Google Rich Results Test. No Search Console data, index coverage, actual impressions or external validator results were available. No source changes were made by this audit.
