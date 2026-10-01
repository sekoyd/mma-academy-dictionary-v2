"""Build a public, crawlable copy of the site in dist/.

- Strips internal editorial data (Notes, Content Status, private Notion link, internal file names)
  and drops undefined Sözlük placeholders.
- Prerenders the full term list into index.html so crawlers and AI assistants see the definitions
  without running JavaScript (app.js re-renders the same list on load).
- Writes one static page per term (/term/<slug>/) with its own title, description, canonical and
  schema.org DefinedTerm JSON-LD.
- Writes robots.txt, sitemap.xml, llms.txt and llms-full.txt.
Run: python3 tools/build_public.py
"""

import json
import re
import shutil
import unicodedata
from datetime import date
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
DIST = ROOT / "dist"
SITE_URL = "https://mma-academy-dictionary.vercel.app"
NOTION_PREFIX = "https://app.notion.com/"
PLACEHOLDERS = {"Zebra Consumer", "VIDS"}
# Kept in the data, not published (2026-09-23 curation): synonyms merged into GEO and niche
# technical/legal acronyms a working marketer rarely meets. Matched on the acronym before " (".
UNPUBLISHED_ACRONYMS = {
    "AISO", "AIVO", "SAIO", "GSO", "AAIO", "ACO",
    "DDRF", "VLOP", "PPA", "AAK", "GPM", "AIMS", "AI RMF", "AI TRiSM", "LLMOps", "AgentOps", "CUA",
    "LAM", "MAS", "AdCP", "ACS", "KYA", "x402", "NLWeb", "AAMP", "RMaaS", "CPAS", "FMN", "PETs",
    "PAIR", "SLM", "ZCS", "SoA", "ACR", "AU", "GPAI", "RAI", "SXO", "GPP", "MFA", "CSRD",
    "GTM Engineer", "RevOps", "AMC", "AIGC",
}
PUBLIC_SOURCE = "MMA Academy Sözlük"
DEFAULT_CATEGORY = "Retail Media"
SET_NAME = "MMA Academy Dictionary"
PUBLISHER = {
    "@type": "Organization",
    "name": "MMA Academy, Marketing + Media Alliance MEA",
    "alternateName": ["MMA MEA", "Marketing + Media Alliance"],
    "url": "https://www.mmaglobal.com/",
}


def slugify(value: str) -> str:
    """Mirror of app.js slugify(): Turkish İ/ı -> i, accents stripped."""
    value = unicodedata.normalize("NFKD", value.replace("İ", "i").replace("ı", "i").lower())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def prepare_dist():
    link, saved = DIST / ".vercel", ROOT / ".vercel-dist-link"
    if link.exists():
        shutil.rmtree(saved, ignore_errors=True)
        shutil.move(str(link), str(saved))
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(SITE, DIST)
    if saved.exists():
        shutil.move(str(saved), str(link))
    (DIST / ".vercelignore").write_text(".env*\n.gitignore\n", encoding="utf-8")


def public_records():
    path = DIST / "data/glossary-source.json"
    headers, *rows = json.loads(path.read_text(encoding="utf-8"))
    col = {h: i for i, h in enumerate(headers)}
    public_rows = []
    for row in rows:
        if row[col["Term"]] in PLACEHOLDERS or row[col["Term"]].split(" (")[0] in UNPUBLISHED_ACRONYMS:
            continue
        row[col["Notes"]] = None
        row[col["Content Status"]] = None
        row[col["Publication Status"]] = None
        source = str(row[col["Source Document"]] or "")
        if source.startswith("MMA Sözlük"):
            row[col["Source Document"]] = PUBLIC_SOURCE
        elif source.lower().endswith(".docx"):
            row[col["Source Document"]] = f"MMA {source[:-5]}"
        links = [u for u in str(row[col["Source Link"]] or "").split() if not u.startswith(NOTION_PREFIX)]
        row[col["Source Link"]] = " ".join(links) or None
        public_rows.append(row)
    path.write_text(json.dumps([headers, *public_rows], ensure_ascii=False), encoding="utf-8")

    # Same id and ordering rules as app.js normalizeRecords().
    seen, records = {}, []
    for row in public_rows:
        r = {h: (row[i] or "") for h, i in col.items()}
        seen[r["Term"]] = seen.get(r["Term"], 0) + 1
        r["id"] = slugify(r["Term"]) + (f"-{seen[r['Term']]}" if seen[r["Term"]] > 1 else "")
        r["definition"] = r["Short Definition"] or r["Source Definition / Long Explanation"]
        r["category"] = r["Tags / Taxonomy"] or DEFAULT_CATEGORY
        records.append(r)
    records.sort(key=lambda r: (r["Letter"], r["Term"].casefold()))
    return records


def preview(text: str) -> str:
    clean = re.sub(r"\s+", " ", text).strip()
    return clean if len(clean) <= 180 else clean[:177] + "…"


def prerender_list(records) -> str:
    out, groups = [], {}
    for r in records:
        groups.setdefault(r["Letter"] or "#", []).append(r)
    for letter, items in groups.items():
        rows = "".join(
            f'<a class="term-row" href="term/{r["id"]}/"><span class="term-name">{escape(r["Term"])}</span>'
            f'<p class="term-preview">{escape(preview(r["definition"]))}</p>'
            f'<span class="term-tail"><span class="term-arrow" aria-hidden="true">↗</span></span></a>'
            for r in items
        )
        out.append(
            f'<section class="letter-group" id="letter-{letter}" data-letter="{letter}">'
            f'<h3 class="group-letter">{letter}</h3><div class="group-terms">{rows}</div></section>'
        )
    return "".join(out)


def term_jsonld(r) -> dict:
    data = {
        "@type": "DefinedTerm",
        "@id": f"{SITE_URL}/term/{r['id']}/",
        "name": r["Term"],
        "description": r["definition"],
        "url": f"{SITE_URL}/term/{r['id']}/",
        "inDefinedTermSet": f"{SITE_URL}/#termset",
    }
    if r["TR Equivalent"]:
        data["alternateName"] = r["TR Equivalent"]
    return data


def site_jsonld(records) -> str:
    graph = [
        {"@type": "WebSite", "@id": f"{SITE_URL}/#website", "url": f"{SITE_URL}/", "name": SET_NAME,
         "inLanguage": ["en", "tr"], "publisher": PUBLISHER},
        {"@type": "DefinedTermSet", "@id": f"{SITE_URL}/#termset", "name": SET_NAME, "url": f"{SITE_URL}/",
         "description": "Marketing dictionary with English and Turkish definitions: AI and marketing concepts, "
                        "MMA programs and frameworks, digital marketing acronyms, and retail media.",
         "publisher": PUBLISHER,
         "hasDefinedTerm": [{"@type": "DefinedTerm", "name": r["Term"], "url": f"{SITE_URL}/term/{r['id']}/"}
                            for r in records]},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False)


def parse_week(value):
    week, _, hook = str(value or "").partition(" | ")
    return (week, hook) if week else None


def prerender_term_of_week(records) -> str:
    picks = sorted((r for r in records if parse_week(r.get("Featured Week"))),
                   key=lambda r: parse_week(r["Featured Week"])[0], reverse=True)
    if not picks:
        return ""
    cur = picks[0]
    week, hook = parse_week(cur["Featured Week"])
    past = " · ".join(f'<a href="term/{r["id"]}/">{escape(r["Term"])}</a>' for r in picks[1:5])
    return (f'<div class="tow-inner"><p class="eyebrow">Term of the week · {escape(week)}</p>'
            f'<h2 id="tow-title"><a href="term/{cur["id"]}/">{escape(cur["Term"])}</a></h2>'
            f'<p class="tow-definition">{escape(cur["definition"])}</p>'
            + (f'<p class="tow-hook">{escape(hook)}</p>' if hook else "")
            + (f'<p class="tow-past">Previous: {past}</p>' if past else "") + "</div>")


def detail(label, value):
    return f'<div class="detail-block"><h3>{label}</h3><p>{escape(value)}</p></div>' if value else ""


def term_page(r) -> str:
    url = f"{SITE_URL}/term/{r['id']}/"
    desc = preview(r["definition"])
    long_text = r["Source Definition / Long Explanation"] if r["Short Definition"] else ""
    links = [u for u in r["Source Link"].split() if u]
    sources = "".join(f'<li><a href="{escape(u)}" rel="nofollow noopener">{escape(u)}</a></li>' for u in links)
    jsonld = {"@context": "https://schema.org", "@graph": [
        {**term_jsonld(r), "termCode": r["id"],
         "inDefinedTermSet": {"@type": "DefinedTermSet", "@id": f"{SITE_URL}/#termset", "name": SET_NAME, "url": f"{SITE_URL}/"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": SET_NAME, "item": f"{SITE_URL}/"},
            {"@type": "ListItem", "position": 2, "name": r["Term"], "item": url}]},
    ]}
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{escape(r["Term"])}: definition | MMA Academy Dictionary</title>
    <meta name="description" content="{escape(desc)}" />
    <link rel="canonical" href="{url}" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="{escape(r["Term"])} | MMA Academy Dictionary" />
    <meta property="og:description" content="{escape(desc)}" />
    <meta property="og:url" content="{url}" />
    <meta property="og:image" content="{SITE_URL}/assets/images/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="../../favicon.ico" sizes="any" />
    <link rel="apple-touch-icon" href="../../assets/icons/apple-touch-icon.png" />
    <link rel="stylesheet" href="../../styles.css?v=15" />
    <script type="application/ld+json">{json.dumps(jsonld, ensure_ascii=False)}</script>
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="../../" aria-label="MMA Academy Dictionary home">
        <img src="../../assets/images/mma-academy-header.png" width="800" height="177" alt="MMA Academy, Marketing + Media Alliance MEA" />
      </a>
    </header>
    <main class="term-page">
      <a class="crumb" href="../../#letter-{r["Letter"]}">← MMA Academy Dictionary</a>
      <div class="dialog-flags"><span class="term-chip">{escape(r["category"])}</span>{f'<span class="term-chip review">Term of the week · {escape(parse_week(r.get("Featured Week"))[0])}</span>' if parse_week(r.get("Featured Week")) else ""}</div>
      <h1>{escape(r["Term"])}</h1>
      <p class="lede">{escape(r["definition"])}</p>
      <div class="dialog-details">
        {detail("Why this week", (parse_week(r.get("Featured Week")) or ("", ""))[1])}
        {detail("Current status", r.get("Current Status"))}
        {detail("Explanation", long_text)}
        {detail("Usage context / examples", r["Usage Context / Examples"])}
        {detail("MMA connection", r.get("MMA Connection"))}
        {detail("Related terms", r["Synonyms / Related Terms"])}
        {detail("Turkish equivalent", r["TR Equivalent"])}
        {detail("Turkish definition", r["TR Definition"])}
      </div>
      <div class="source-line">
        <p>Source: {escape(r["Source Document"] or "MMA Academy master glossary")}</p>
        {f"<ul>{sources}</ul>" if sources else ""}
      </div>
    </main>
  </body>
</html>
"""


def write_crawl_files(records):
    today = date.today().isoformat()
    urls = [f"{SITE_URL}/"] + [f"{SITE_URL}/term/{r['id']}/" for r in records]
    (DIST / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls)
        + "</urlset>\n", encoding="utf-8")
    (DIST / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\n"
        "# AI crawlers are welcome to read and cite this dictionary.\n"
        + "".join(f"User-agent: {bot}\nAllow: /\n\n" for bot in
                  ("GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended"))
        + f"Sitemap: {SITE_URL}/sitemap.xml\n", encoding="utf-8")

    cats = {}
    for r in records:
        cats.setdefault(r["category"], []).append(r)
    head = (f"# {SET_NAME}\n\n> A marketing dictionary published by MMA Academy (Marketing + Media Alliance, MEA region) "
            f"with {len(records)} terms, each defined in English and Turkish. Categories: AI and marketing concepts, "
            "consumer and culture trends, leadership and organization, technology trends, MMA programs and frameworks, "
            "digital marketing acronyms, and retail media.\n\n"
            "MMA here means Marketing + Media Alliance (formerly Mobile Marketing Association), not mixed martial arts.\n\n")
    short = head + "".join(
        f"## {cat}\n\n" + "".join(f"- [{r['Term']}]({SITE_URL}/term/{r['id']}/): {preview(r['definition'])}\n" for r in items) + "\n"
        for cat, items in cats.items())
    (DIST / "llms.txt").write_text(short, encoding="utf-8")
    full = head + "".join(
        f"## {r['Term']}\n\nCategory: {r['category']}\nURL: {SITE_URL}/term/{r['id']}/\n\n{r['definition']}\n\n"
        + (f"Status: {r['Current Status']}\n\n" if r.get("Current Status") else "")
        + (f"{r['Source Definition / Long Explanation']}\n\n" if r["Short Definition"] and r["Source Definition / Long Explanation"] else "")
        + (f"Turkish: {r['TR Equivalent']}. " if r["TR Equivalent"] else "")
        + (f"{r['TR Definition']}\n\n" if r["TR Definition"] else "")
        for r in records)
    (DIST / "llms-full.txt").write_text(full, encoding="utf-8")


def main():
    prepare_dist()
    records = public_records()

    index = DIST / "index.html"
    html = index.read_text(encoding="utf-8")
    html = html.replace("<!--PRERENDER-->", prerender_list(records))
    tow = prerender_term_of_week(records)
    if tow:
        html = html.replace(' aria-labelledby="tow-title" hidden><!--TERM_OF_WEEK-->', f' aria-labelledby="tow-title">{tow}')
    html = html.replace("<!--JSONLD-->", f'<script type="application/ld+json">{site_jsonld(records)}</script>')
    index.write_text(html, encoding="utf-8")

    for r in records:
        page = DIST / "term" / r["id"] / "index.html"
        page.parent.mkdir(parents=True, exist_ok=True)
        page.write_text(term_page(r), encoding="utf-8")

    write_crawl_files(records)

    public_text = (DIST / "data/glossary-source.json").read_text(encoding="utf-8").lower()
    leaked = [t for t in ("editorial review", NOTION_PREFIX, ".docx") if t in public_text]
    print(f"public records={len(records)} term pages={len(records)} leaks={leaked}")


if __name__ == "__main__":
    main()
