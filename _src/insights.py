"""Insights: posts written as Markdown files in _src/posts/.

Each post starts with a front-matter block:

    ---
    title: How we use AI
    date: 2026-10-09
    category: technology-ai
    summary: One or two sentences shown on listing pages and in search results.
    draft: true
    image: /img/insights/how-we-use-ai.webp      (optional featured image, made by _src/featured_images.py)
    image_alt: What the image shows, for screen readers and search
    description: Optional search-result description (max ~155 characters); defaults to summary
    ---

    The body, in Markdown.

The slug (URL) is the file name without .md, e.g. _src/posts/how-we-use-ai.md -> /insights/how-we-use-ai/.
Drafts are skipped unless the build runs with --drafts (used for previews).

Supported Markdown: ## and ### headings, paragraphs, - and 1. lists, > quotes, --- rules,
**bold**, *italic*, `code` and [links](https://example.com), and images on a line of their
own: ![alt text](/img/insights/<slug>-2.webp) (made by _src/featured_images.py from image_2_prompt).
"""
import datetime as dt
import html
import re
import urllib.parse
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
        "slug": "start-a-business",
        "name": "Starting a Business",
        "icon": "earth-asia",
        "description": "Setting up a company or online store in a new market: registration, requirements and VAT, country by country.",
    },
    {
        "slug": "market-gaps",
        "name": "Market Gaps",
        "icon": "magnifying-glass-chart",
        "description": "The gaps we look for in markets, and how we decide which ones are worth filling.",
    },
]
CAT = {c["slug"]: c for c in CATEGORIES}
STATIC = Path(__file__).resolve().parent.parent / "static"
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


def _figure(src, alt):
    """An image placed in a post body; uses the -800 variant on small screens when it exists."""
    small = re.sub(r"\.webp$", "-800.webp", src)
    srcset = f' srcset="{small} 800w, {src} 1600w" sizes="(max-width: 760px) 100vw, 760px"' if small != src and (STATIC / small.lstrip("/")).is_file() else ""
    return (f'<figure class="post-inline"><img src="{src}"{srcset} alt="{html.escape(alt)}" width="1600" height="900" '
            'loading="lazy" decoding="async"></figure>')


def _anchor(text, used):
    """id for a ## heading, unique within the post."""
    base = re.sub(r"[^a-z0-9]+", "-", re.sub(r"<[^>]+>|&[a-z]+;", "", text).lower()).strip("-")[:60].strip("-") or "section"
    a, n = base, 2
    while a in used:
        a, n = f"{base}-{n}", n + 1
    used.add(a)
    return a


def markdown(text):
    out, para, lst, quote = [], [], None, []
    ids = set()

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
            flush(); h = _inline(s[3:]); out.append(f'<h2 id="{_anchor(h, ids)}">{h}</h2>'); continue
        if s in ("---", "***"):
            flush(); out.append("<hr>"); continue
        m = re.match(r"^!\[([^\]]+)\]\((/img/[^)\s]+)\)$", s)
        if m:
            flush(); out.append(_figure(m.group(2), m.group(1))); continue
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
        image = meta.get("image") or None
        og_image = None
        if image:
            if not (src.parent / "static" / image.lstrip("/")).is_file():
                raise SystemExit(f"{path.name}: image {image} not found in static/")
            if not meta.get("image_alt"):
                raise SystemExit(f"{path.name}: image needs image_alt")
            og = re.sub(r"\.\w+$", "-og.jpg", image)
            og_image = og if (src.parent / "static" / og.lstrip("/")).is_file() else None
        if draft and not include_drafts:
            continue
        body = m.group(2)
        for img in re.findall(r"^\s*!\[[^\]]+\]\((/img/[^)\s]+)\)\s*$", body, re.M):
            if not (src.parent / "static" / img.lstrip("/")).is_file():
                raise SystemExit(f"{path.name}: image {img} not found in static/ (run _src/featured_images.py {path.stem})")
        words = len(re.findall(r"\w+", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body)))
        published = dt.date.fromisoformat(meta["date"])
        updated = dt.date.fromisoformat(meta.get("updated", meta["date"]))
        if updated < published or updated > dt.date.today():
            raise SystemExit(f"{path.name}: updated must be between publication and today")
        posts.append({
            "slug": path.stem,
            "title": meta["title"],
            "date": published,
            "updated": updated,
            "has_update": "updated" in meta,
            "category": CAT[meta["category"]],
            "summary": meta["summary"],
            "description": meta.get("description") or meta["summary"],
            "draft": draft,
            "image": image,
            "image_alt": meta.get("image_alt", ""),
            "og_image": og_image,
            "html": markdown(body),
            "minutes": max(1, round(words / WPM)),
        })
    posts.sort(key=lambda p: (p["date"], p["title"]), reverse=True)
    return posts


def _date(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def _srcset(p):
    """srcset for a featured image, using the -800 variant when it exists."""
    small = re.sub(r"\.webp$", "-800.webp", p["image"])
    if small != p["image"] and (Path(__file__).resolve().parent.parent / "static" / small.lstrip("/")).is_file():
        return f' srcset="{small} 800w, {p["image"]} 1600w"'
    return ""


def _thumb(p):
    if not p["image"]:
        return ""
    # Decorative here: the post title right below is the link text
    return f'\n          <img class="post-thumb" src="{p["image"]}"{_srcset(p)} sizes="(max-width: 640px) 100vw, (max-width: 960px) 50vw, 440px" alt="" width="1600" height="900" loading="lazy" decoding="async">'


def _card(p):
    draft = '<span class="post-draft">Draft</span>' if p["draft"] else ""
    return f'''      <article class="post-card reveal">
        <a href="/insights/{p["slug"]}/">{_thumb(p)}
          <span class="post-cat"><i class="fa-solid fa-{p["category"]["icon"]}" aria-hidden="true"></i>{html.escape(p["category"]["name"])}</span>{draft}
          <h3 class="post-title">{html.escape(p["title"])}</h3>
          <p>{html.escape(p["summary"])}</p>
          <span class="post-meta"><time datetime="{p["date"].isoformat()}">{_date(p["date"])}</time> · {p["minutes"]} min read</span>
        </a>
      </article>'''


def used_categories(posts):
    """Categories with at least one post, so empty ones are not linked anywhere."""
    return [c for c in CATEGORIES if any(p["category"]["slug"] == c["slug"] for p in posts)]


def _cat_side(active, posts, current=True):
    """Category filter for the blog sidebars. On listings the active link is the current page;
    on a post it is the post's category, highlighted without aria-current."""
    counts = {c["slug"]: sum(1 for p in posts if p["category"]["slug"] == c["slug"]) for c in CATEGORIES}
    mark = lambda on: (' aria-current="page"' if current else ' class="is-active"') if on else ""
    links = [f'<a href="/insights/"{mark(current and active is None)}><i class="fa-solid fa-layer-group" aria-hidden="true"></i>All posts<span class="blog-count">{len(posts)}</span></a>']
    for c in used_categories(posts):
        links.append(f'<a href="/insights/{c["slug"]}/"{mark(active == c["slug"])}><i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>'
                     f'{html.escape(c["name"])}<span class="blog-count">{counts[c["slug"]]}</span></a>')
    return ('      <h2 class="blog-side-title" id="blog-cats">Categories</h2>\n'
            '      <nav class="blog-cats" aria-label="Blog categories">\n        ' + "\n        ".join(links) + "\n      </nav>\n")


def _layout(active, posts, listed, empty):
    """Blog listing: category sidebar on the left, post grid on the right."""
    return ('<section class="section" style="padding-top:24px">\n  <div class="container blog-layout">\n'
            '    <aside class="blog-side" aria-labelledby="blog-cats">\n' + _cat_side(active, posts) + "    </aside>\n"
            '    <div class="blog-main">\n' + _grid(listed, empty) + "\n    </div>\n  </div>\n</section>\n")


def _toc(p, url):
    """Table of Contents from the post's ## headings, plus share links. Empty for short posts."""
    heads = re.findall(r'<h2 id="([^"]+)">(.*?)</h2>', p["html"])
    if len(heads) < 2:
        return ""
    items, n = [], 0
    for anchor, label in heads:
        plain = re.sub(r"<[^>]+>", "", label)
        if re.match(r"(faqs?\b|frequently asked)", plain, re.I):
            num = "?"
        else:
            n += 1
            num = f"{n:02d}"
        items.append(f'<li><a href="#{anchor}"><span class="toc-num" aria-hidden="true">{num}</span><span>{label}</span></a></li>')
    q = urllib.parse.quote
    share = (f'<div class="post-share" aria-label="Share this post">'
             f'<a href="https://twitter.com/intent/tweet?url={q(url, safe="")}&amp;text={q(p["title"], safe="")}" target="_blank" rel="noopener" aria-label="Share on X"><i class="fa-brands fa-x-twitter" aria-hidden="true"></i></a>'
             f'<a href="https://www.facebook.com/sharer/sharer.php?u={q(url, safe="")}" target="_blank" rel="noopener" aria-label="Share on Facebook"><i class="fa-brands fa-facebook" aria-hidden="true"></i></a>'
             f'<a href="https://www.linkedin.com/sharing/share-offsite/?url={q(url, safe="")}" target="_blank" rel="noopener" aria-label="Share on LinkedIn"><i class="fa-brands fa-linkedin" aria-hidden="true"></i></a>'
             f'<button type="button" class="share-copy" data-url="{url}" aria-label="Copy link to this post"><i class="fa-solid fa-link" aria-hidden="true"></i></button>'
             '</div>')
    return ('  <aside class="post-toc" aria-labelledby="toc-title">\n    <h2 class="blog-side-title" id="toc-title">Table of Contents</h2>\n'
            '    <nav aria-labelledby="toc-title"><ol>' + "".join(items) + '</ol></nav>\n    ' + share + "\n  </aside>\n")


def _short_date(d):
    return f"{d.strftime('%b')} {d.day}, {d.year}"


def _post_side(p, posts):
    """Single post: category filter and a latest-posts slider in a right sidebar."""
    latest = [q for q in posts if q is not p][:4]
    slides = []
    for i, q in enumerate(latest):
        img = (f'<img src="{re.sub(r"[.]webp$", "-800.webp", q["image"]) if q["image"] else ""}" alt="" width="800" height="450" loading="lazy" decoding="async">'
               if q["image"] else "")
        slides.append(
            f'<li class="feat-slide" id="feat-{i + 1}" aria-roledescription="slide" aria-label="{i + 1} of {len(latest)}">'
            f'<a href="/insights/{q["slug"]}/">{img}'
            f'<span class="feat-cat">{html.escape(q["category"]["name"])}</span>'
            f'<span class="feat-text"><span class="feat-meta"><strong>FXN Holdings</strong> on <time datetime="{q["date"].isoformat()}">{_short_date(q["date"])}</time></span>'
            f'<span class="feat-title">{html.escape(q["title"])}</span></span></a></li>')
    dots = "".join(f'<button type="button" class="feat-dot" aria-label="Show post {i + 1}"{" aria-current=\"true\"" if i == 0 else ""}></button>' for i in range(len(latest)))
    recent = ('      <h2 class="blog-side-title" id="blog-latest">Latest posts</h2>\n'
              '      <div class="feat" aria-roledescription="carousel" aria-labelledby="blog-latest">\n'
              f'        <ul class="feat-track">{"".join(slides)}</ul>\n'
              + (f'        <div class="feat-dots">{dots}</div>\n' if len(latest) > 1 else "")
              + "      </div>\n") if latest else ""
    return '  <aside class="blog-side post-side" aria-labelledby="blog-cats">\n' + _cat_side(p["category"]["slug"], posts, current=False) + recent + "  </aside>\n"


def _grid(posts, empty):
    if not posts:
        return f'''    <div class="post-empty">
      <i class="fa-solid fa-pen-nib" aria-hidden="true"></i>
      <h2 class="h4">First posts coming soon</h2>
      <p>{empty}</p>
      <a class="btn btn-outline" href="/insights/">All posts {ARROW}</a>
    </div>'''
    return '    <div class="post-grid">\n' + "\n".join(_card(p) for p in posts) + "\n    </div>"


def latest_section(posts, n=3):
    """Homepage block linking the newest posts; empty when nothing is published."""
    if not posts:
        return ""
    return ('<section class="section" style="padding-top:0" id="blog">\n  <div class="container">\n'
            '    <div class="split-head"><h2 class="h2 reveal">Latest from the blog</h2>'
            f'<a class="btn btn-outline reveal d1" href="/insights/">All posts {ARROW}</a></div>\n'
            + _grid(posts[:n], "") + "\n  </div>\n</section>")


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
    crumbs_root = [("Home", site + "/"), ("Blog", site + "/insights/")]

    yield ({
        "title": "Blog | FXN Holdings",
        "description": "The FXN Holdings blog: technology and AI, company news, and the market gaps we look for when we build and launch new platforms.",
        "path": "/insights/", "nav": "insights", "crumbs": crumbs_root,
        # Keep empty listings out of search results until there is something to list.
        "noindex": not posts,
    }, _hero('<span class="live-dot" aria-hidden="true"></span>Blog', "The FXN Holdings blog",
             "Notes on how we build, what we're launching, and the market gaps we think are worth filling.")
       + "\n" + _layout(None, posts, posts, "We're writing our first articles. Check back soon.") + _cta())

    for c in CATEGORIES:
        in_cat = [p for p in posts if p["category"]["slug"] == c["slug"]]
        yield ({
            "title": f"{c['name']} | Blog | FXN Holdings",
            "description": c["description"],
            "path": f"/insights/{c['slug']}/", "nav": "insights",
            # A category with one post only repeats the main listing; index it from two posts up
            "noindex": len(in_cat) < 2,
            "crumbs": crumbs_root + [(c["name"], f"{site}/insights/{c['slug']}/")],
        }, _hero(f'<i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>Blog', html.escape(c["name"]), html.escape(c["description"]))
           + "\n" + _layout(c["slug"], posts, in_cat, f"There are no {html.escape(c['name'])} posts yet.") + _cta())

    for p in posts:
        c = p["category"]
        url = f"{site}/insights/{p['slug']}/"
        related = [q for q in posts if q is not p and q["category"] is c][:3] or [q for q in posts if q is not p][:3]
        draft_note = '<p class="post-draft-note"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>Draft for review. This post is not published on the live site.</p>' if p["draft"] else ""
        figure = (f'  <figure class="post-figure"><img src="{p["image"]}"{_srcset(p)} sizes="(max-width: 1366px) 100vw, 1366px" alt="{html.escape(p["image_alt"])}" width="1600" height="900" fetchpriority="high" decoding="async"></figure>\n'
                  if p["image"] else "")
        toc = _toc(p, url)
        meta_line = (f'<p class="post-byline reveal d3"><a href="/insights/{c["slug"]}/"><i class="fa-solid fa-{c["icon"]}" aria-hidden="true"></i>{html.escape(c["name"])}</a>'
                     f' · <time datetime="{p["date"].isoformat()}">{_date(p["date"])}</time> · {p["minutes"]} min read · FXN Holdings</p>')
        if p["has_update"]:
            meta_line += f'<p class="post-byline">Updated <time datetime="{p["updated"].isoformat()}">{_date(p["updated"])}</time></p>'
        body = (_hero('<a href="/insights/">Blog</a>', html.escape(p["title"]), html.escape(p["summary"]), meta_line)
                + f'\n<div class="container post-wrap post-layout">\n  <div class="post-main">\n  {draft_note}\n{figure}  <div class="post-content{" has-toc" if toc else ""}">\n{toc}  <article class="post-body">\n{p["html"]}\n  </article>\n  </div>\n  </div>\n{_post_side(p, posts)}</div>\n')
        if related:
            body += ('\n<section class="section" style="padding-top:64px">\n  <div class="container">\n    <div class="split-head"><h2 class="h2 reveal">More from the blog</h2>'
                     f'<a class="btn btn-outline reveal d1" href="/insights/">All posts {ARROW}</a></div>\n'
                     + _grid(related, "") + "\n  </div>\n</section>\n")
        body += _cta()
        article = {
            "@context": "https://schema.org", "@type": "BlogPosting",
            "headline": p["title"], "description": p["summary"],
            "datePublished": p["date"].isoformat(), "dateModified": p["updated"].isoformat(),
            "articleSection": c["name"], "inLanguage": "en-AU",
            "mainEntityOfPage": url, "url": url,
            "image": [site + i for i in (p["image"], p["og_image"]) if i] or site + "/img/og-image.png",
            "author": {"@type": "Organization", "name": "FXN Holdings", "url": site + "/"},
            "publisher": {"@type": "Organization", "name": "FXN Holdings", "logo": {"@type": "ImageObject", "url": site + "/img/fxn-holdings-logo.svg"}},
        }
        yield ({
            "title": f"{p['title']} | FXN Holdings",
            "description": p["description"],
            "path": f"/insights/{p['slug']}/", "nav": "insights", "og_type": "article",
            "noindex": p["draft"],
            "og_image": p["og_image"], "og_image_alt": p["image_alt"] if p["og_image"] else None,
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
  <title>FXN Holdings Blog</title>
  <link>{site}/insights/</link>
  <atom:link href="{site}/insights/feed.xml" rel="self" type="application/rss+xml"/>
  <description>Technology and AI, company news, and market gaps from FXN Holdings.</description>
  <language>en-AU</language>
{chr(10).join(items)}
</channel>
</rss>
"""
