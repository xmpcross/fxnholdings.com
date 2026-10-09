"""Insights: posts written as Markdown files in _src/posts/.

Each post starts with a front-matter block:

    ---
    title: How we use AI
    date: 2026-10-09
    category: technology-ai
    summary: One or two sentences shown on listing pages and in search results.
    draft: true
    ---

    The body, in Markdown.

The slug (URL) is the file name without .md, e.g. _src/posts/how-we-use-ai.md -> /insights/how-we-use-ai/.
Drafts are skipped unless the build runs with --drafts (used for previews).

Supported Markdown: ## and ### headings, paragraphs, - and 1. lists, > quotes, --- rules,
**bold**, *italic*, `code` and [links](https://example.com).
"""
import datetime as dt
import html
import re
from pathlib import Path

CATEGORIES = [
    {
        "slug": "technology-ai",
        "name": "Technology & AI",
        "icon": "microchip",
        "description": "How we build our platforms: open-source tools, shared infrastructure, and AI used responsibly.",
    },
    {
        "slug": "company-news",
        "name": "Company News",
        "icon": "bullhorn",
        "description": "Announcements and updates from FXN Holdings and the platforms we run.",
    },
    {
        "slug": "market-gaps",
        "name": "Market Gaps",
        "icon": "magnifying-glass-chart",
        "description": "The gaps we look for in markets, and how we decide which ones are worth filling.",
    },
]
CAT = {c["slug"]: c for c in CATEGORIES}
WPM = 220
ARROW = '<i class="fa-solid fa-arrow-right chev" aria-hidden="true"></i>'
PAT = '<svg class="hero-pattern" aria-hidden="true"><rect width="100%" height="100%" fill="url(#chev-light)"/></svg>'


# ---------------------------------------------------------------- Markdown

def _inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)", r"<em>\1</em>", t)

    def link(m):
        label, href = m.group(1), m.group(2)
        ext = href.startswith("http") and "fxnholdings.com" not in href
        attrs = ' target="_blank" rel="noopener"' if ext else ""
        return f'<a href="{href.replace(chr(34), "%22")}"{attrs}>{label}</a>'

    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", link, t)


def markdown(text):
    out, para, lst, quote = [], [], None, []

    def flush():
        nonlocal para, lst, quote
        if para:
            out.append("<p>" + _inline(" ".join(para)) + "</p>")
            para = []
        if lst:
            tag, items = lst
            out.append(f"<{tag}>" + "".join(f"<li>{_inline(i)}</li>" for i in items) + f"</{tag}>")
            lst = None
        if quote:
            out.append("<blockquote><p>" + _inline(" ".join(quote)) + "</p></blockquote>")
            quote = []

    for line in text.splitlines():
        s = line.strip()
        if not s:
            flush()
            continue
        if s.startswith("### "):
            flush(); out.append(f"<h3>{_inline(s[4:])}</h3>"); continue
        if s.startswith("## "):
            flush(); out.append(f"<h2>{_inline(s[3:])}</h2>"); continue
        if s in ("---", "***"):
            flush(); out.append("<hr>"); continue
        if s.startswith("> "):
            if para or lst: flush()
            quote.append(s[2:]); continue
        m = re.match(r"^(-|\*|\d+\.)\s+(.*)", s)
        if m:
            tag = "ol" if m.group(1)[0].isdigit() else "ul"
            if para or quote or (lst and lst[0] != tag): flush()
            if not lst: lst = (tag, [])
            lst[1].append(m.group(2)); continue
        if lst or quote: flush()
        para.append(s)
    flush()
    return "\n".join(out)


# ---------------------------------------------------------------- Posts

def load_posts(src, include_drafts):
    posts = []
    for path in sorted((src / "posts").glob("*.md")):
        raw = path.read_text()
        m = re.match(r"---\n(.*?)\n---\n(.*)", raw, re.S)
        if not m:
            raise SystemExit(f"{path.name}: missing front matter")
        meta = {}
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        for key in ("title", "date", "category", "summary"):
            if not meta.get(key):
                raise SystemExit(f"{path.name}: front matter needs '{key}'")
        if meta["category"] not in CAT:
            raise SystemExit(f"{path.name}: unknown category '{meta['category']}' (use one of {', '.join(CAT)})")
        draft = meta.get("draft", "false").lower() == "true"
        if draft and not include_drafts:
            continue
        body = m.group(2)
        words = len(re.findall(r"\w+", body))
        posts.append({
            "slug": path.stem,
            "title": meta["title"],
            "date": dt.date.fromisoformat(meta["date"]),
            "category": CAT[meta["category"]],
            "summary": meta["summary"],
            "draft": draft,
            "html": markdown(body),
            "minutes": max(1, round(words / WPM)),
        })
    posts.sort(key=lambda p: (p["date"], p["title"]), reverse=True)
    return posts


def _date(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def _card(p):
    draft = '<span class="post-draft">Draft</span>' if p["draft"] else ""
    return f'''      <article class="post-card reveal">
        <a href="/insights/{p["slug"]}/">
          <span class="post-cat"><i class="fa-solid fa-{p["category"]["icon"]}" aria-hidden="true"></i>{html.escape(p["category"]["name"])}</span>{draft}
          <h3 class="post-title">{html.escape(p["title"])}</h3>
          <p>{html.escape(p["summary"])}</p>
          <span class="post-meta"><time datetime="{p["date"].isoformat()}">{_date(p["date"])}</time> · {p["minutes"]} min read</span>
        </a>
      </article>'''


def used_categories(posts):
    """Categories with at least one post, so empty ones are not linked anywhere."""
    return [c for c in CATEGORIES if any(p["category"]["slug"] == c["slug"] for p in posts)]


def _filters(active, posts):
    links = [f'<a href="/insights/"{" aria-current=\"page\"" if active is None else ""}>All</a>']
    for c in used_categories(posts):
        cur = ' aria-current="page"' if active == c["slug"] else ""
        links.append(f'<a href="/insights/{c["slug"]}/"{cur}><i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>{html.escape(c["name"])}</a>')
    return '<nav class="anchor-nav post-filters reveal d3" aria-label="Categories">\n      ' + "\n      ".join(links) + "\n    </nav>"


def _grid(posts, empty):
    if not posts:
        return f'''    <div class="post-empty">
      <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
      <h2 class="h4">First posts coming soon</h2>
      <p>{empty}</p>
      <a class="btn btn-outline" href="/insights/">All insights {ARROW}</a>
    </div>'''
    return '    <div class="post-grid">\n' + "\n".join(_card(p) for p in posts) + "\n    </div>"


def _hero(eyebrow, title, lead, extra=""):
    return f'''<section class="page-hero compact">
  {PAT}
  <div class="container page-hero-inner">
    <p class="eyebrow reveal">{eyebrow}</p>
    <h1 class="h1 reveal d1">{title}</h1>
    <p class="lead reveal d2">{lead}</p>
    {extra}
  </div>
</section>
'''


def _cta():
    return f'''
<section class="cta">
  <svg class="cta-pattern" aria-hidden="true"><rect width="100%" height="100%" fill="url(#chev-dark)"/></svg>
  <div class="container cta-inner">
    <h2 class="h2 reveal">Have a market, a product or an idea worth launching?</h2>
    <p class="reveal d1">We work with suppliers, brands, affiliate and advertising networks, developers and founders.</p>
    <a class="btn btn-primary btn-lg reveal d2" href="/contact/">Start a conversation {ARROW}</a>
  </div>
</section>
'''


def pages(posts, site):
    """Yield (meta, body) for every Insights page."""
    crumbs_root = [("Home", site + "/"), ("Insights", site + "/insights/")]

    yield ({
        "title": "Insights | FXN Holdings",
        "description": "Insights from FXN Holdings on technology and AI, company news, and the market gaps we look for when we build and launch new platforms.",
        "path": "/insights/", "nav": "insights", "crumbs": crumbs_root,
        # Keep empty listings out of search results until there is something to list.
        "noindex": not posts,
    }, _hero('<span class="live-dot" aria-hidden="true"></span>Insights', "Insights from FXN Holdings",
             "Notes on how we build, what we're launching, and the market gaps we think are worth filling.", _filters(None, posts))
       + '\n<section class="section" style="padding-top:24px">\n  <div class="container">\n'
       + _grid(posts, "We're writing our first articles. Check back soon.") + "\n  </div>\n</section>\n" + _cta())

    for c in CATEGORIES:
        in_cat = [p for p in posts if p["category"]["slug"] == c["slug"]]
        yield ({
            "title": f"{c['name']} | Insights | FXN Holdings",
            "description": c["description"],
            "path": f"/insights/{c['slug']}/", "nav": "insights", "noindex": not in_cat,
            "crumbs": crumbs_root + [(c["name"], f"{site}/insights/{c['slug']}/")],
        }, _hero(f'<i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>Insights', html.escape(c["name"]), html.escape(c["description"]), _filters(c["slug"], posts))
           + '\n<section class="section" style="padding-top:24px">\n  <div class="container">\n'
           + _grid(in_cat, f"There are no {html.escape(c['name'])} posts yet.") + "\n  </div>\n</section>\n" + _cta())

    for p in posts:
        c = p["category"]
        url = f"{site}/insights/{p['slug']}/"
        related = [q for q in posts if q is not p and q["category"] is c][:3] or [q for q in posts if q is not p][:3]
        draft_note = '<p class="post-draft-note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>Draft for review. This post is not published on the live site.</p>' if p["draft"] else ""
        meta_line = (f'<p class="post-byline reveal d3"><a href="/insights/{c["slug"]}/"><i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>{html.escape(c["name"])}</a>'
                     f' · <time datetime="{p["date"].isoformat()}">{_date(p["date"])}</time> · {p["minutes"]} min read · FXN Holdings</p>')
        body = (_hero('<a href="/insights/">Insights</a>', html.escape(p["title"]), html.escape(p["summary"]), meta_line)
                + f'\n<div class="container post-wrap">\n  {draft_note}\n  <article class="post-body">\n{p["html"]}\n  </article>\n</div>\n')
        if related:
            body += ('\n<section class="section" style="padding-top:64px">\n  <div class="container">\n    <div class="split-head"><h2 class="h2 reveal">More insights</h2>'
                     f'<a class="btn btn-outline reveal d1" href="/insights/">All insights {ARROW}</a></div>\n'
                     + _grid(related, "") + "\n  </div>\n</section>\n")
        body += _cta()
        article = {
            "@context": "https://schema.org", "@type": "BlogPosting",
            "headline": p["title"], "description": p["summary"],
            "datePublished": p["date"].isoformat(), "dateModified": p["date"].isoformat(),
            "articleSection": c["name"], "inLanguage": "en-AU",
            "mainEntityOfPage": url, "url": url, "image": site + "/img/og-image.png",
            "author": {"@type": "Organization", "name": "FXN Holdings", "url": site + "/"},
            "publisher": {"@type": "Organization", "name": "FXN Holdings", "logo": {"@type": "ImageObject", "url": site + "/img/fxn-holdings-logo.svg"}},
        }
        yield ({
            "title": f"{p['title']} | FXN Holdings",
            "description": p["summary"],
            "path": f"/insights/{p['slug']}/", "nav": "insights", "og_type": "article",
            "noindex": p["draft"],
            "crumbs": crumbs_root + [(c["name"], f"{site}/insights/{c['slug']}/"), (p["title"], url)],
            "jsonld_extra": [article],
        }, body)


def feed(posts, site):
    """RSS 2.0 feed of published posts."""
    items = []
    for p in [q for q in posts if not q["draft"]][:20]:
        url = f"{site}/insights/{p['slug']}/"
        pub = dt.datetime.combine(p["date"], dt.time(9, 0)).strftime("%a, %d %b %Y %H:%M:%S +0800")
        items.append(f"""  <item>
    <title>{html.escape(p["title"])}</title>
    <link>{url}</link>
    <guid isPermaLink="true">{url}</guid>
    <pubDate>{pub}</pubDate>
    <category>{html.escape(p["category"]["name"])}</category>
    <description>{html.escape(p["summary"])}</description>
  </item>""")
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>FXN Holdings Insights</title>
  <link>{site}/insights/</link>
  <atom:link href="{site}/insights/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Technology and AI, company news, and market gaps from FXN Holdings.</description>
  <language>en-AU</language>
{chr(10).join(items)}
</channel>
</rss>
"""
