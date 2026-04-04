#!/usr/bin/env python3
"""Build bilingual HTML book site from docx files."""

import zipfile
import xml.etree.ElementTree as ET
import json
import re
import os
import html
import shutil

SITE_DIR = os.path.join(os.path.dirname(__file__), "site")
# Also output to public/books/ for Vercel deployment
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC_BOOKS_DIR = os.path.join(PROJECT_ROOT, "public", "books")

# Chapter metadata for both languages (matched by index)
CHAPTER_SLUGS = [
    "chapter1", "chapter2", "chapter3", "chapter4",
    "chapter5", "chapter6", "chapter7", "chapter8",
]


def extract_table(tbl, ns):
    """Extract a table element into a structured dict."""
    rows = []
    for tr in tbl.findall("w:tr", ns):
        cells = []
        for tc in tr.findall("w:tc", ns):
            text = "".join(t.text or "" for t in tc.findall(".//w:t", ns)).strip()
            cells.append(text)
        rows.append(cells)
    return {"type": "table", "rows": rows}


def process_paragraph(p, ns):
    """Process a single paragraph element, return (style, text)."""
    pPr = p.find("w:pPr", ns)
    style = ""
    if pPr is not None:
        pStyle = pPr.find("w:pStyle", ns)
        if pStyle is not None:
            style = pStyle.get(
                "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val",
                "",
            )
    text = "".join(t.text or "" for t in p.findall(".//w:t", ns)).strip()
    return style, text


def extract_book(docx_path, chapter_pattern):
    """Extract chapters from a docx file."""
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml")

    tree = ET.fromstring(xml_content)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    # Get the document body and iterate over direct children (paragraphs and tables)
    body = tree.find("w:body", ns)
    if body is None:
        return []

    chapters = []
    current_chapter = None

    for elem in body:
        tag = elem.tag.split("}")[-1] if "}" in elem.tag else elem.tag

        if tag == "tbl":
            if current_chapter is not None:
                current_chapter["content"].append(extract_table(elem, ns))
            continue

        if tag != "p":
            continue

        style, text = process_paragraph(elem, ns)
        if not text:
            continue

        if chapter_pattern(text, style):
            if current_chapter:
                chapters.append(current_chapter)
            current_chapter = {"title": text, "content": []}
            continue

        if current_chapter is None:
            continue

        if style == "Heading2":
            current_chapter["content"].append({"type": "h2", "text": text})
        elif style == "Heading3":
            current_chapter["content"].append({"type": "h3", "text": text})
        elif style == "Heading4":
            current_chapter["content"].append({"type": "h4", "text": text})
        else:
            current_chapter["content"].append({"type": "p", "text": text})

    if current_chapter:
        chapters.append(current_chapter)

    return chapters


def en_chapter_pattern(text, style):
    return bool(re.match(r"^Chapter\s+\d+", text)) and "Heading" not in style


def zh_chapter_pattern(text, style):
    return bool(re.match(r"^第[一二三四五六七八九十]+章", text)) and "Heading" not in style


def render_table(table_item):
    """Render a table item to HTML."""
    rows = table_item["rows"]
    if not rows:
        return ""
    parts = ['<table>']
    # First row as header
    parts.append("<thead><tr>")
    for cell in rows[0]:
        parts.append(f"<th>{html.escape(cell)}</th>")
    parts.append("</tr></thead>")
    # Remaining rows as body
    if len(rows) > 1:
        parts.append("<tbody>")
        for row in rows[1:]:
            parts.append("<tr>")
            for cell in row:
                parts.append(f"<td>{html.escape(cell)}</td>")
            parts.append("</tr>")
        parts.append("</tbody>")
    parts.append("</table>")
    return "\n".join(parts)


def render_content(items):
    """Render content items to HTML."""
    parts = []
    for item in items:
        if item["type"] == "table":
            parts.append(render_table(item))
            continue
        t = html.escape(item["text"])
        if item["type"] == "h2":
            anchor = re.sub(r"[^\w]+", "-", item["text"].lower()).strip("-")
            parts.append(f'<h2 id="{anchor}">{t}</h2>')
        elif item["type"] == "h3":
            anchor = re.sub(r"[^\w]+", "-", item["text"].lower()).strip("-")
            parts.append(f'<h3 id="{anchor}">{t}</h3>')
        elif item["type"] == "h4":
            anchor = re.sub(r"[^\w]+", "-", item["text"].lower()).strip("-")
            parts.append(f'<h4 id="{anchor}">{t}</h4>')
        else:
            parts.append(f"<p>{t}</p>")
    return "\n".join(parts)


def render_toc(items):
    """Render in-page table of contents from headings."""
    toc = []
    for item in items:
        if item["type"] in ("h2", "h3"):
            anchor = re.sub(r"[^\w]+", "-", item["text"].lower()).strip("-")
            indent = "toc-h3" if item["type"] == "h3" else "toc-h2"
            toc.append(
                f'<li class="{indent}"><a href="#{anchor}">{html.escape(item["text"])}</a></li>'
            )
    if not toc:
        return ""
    return f'<nav class="chapter-toc"><ul>{"".join(toc)}</ul></nav>'


def build_nav(chapters_en, chapters_zh, current_idx, lang):
    """Build sidebar navigation."""
    chapters = chapters_en if lang == "en" else chapters_zh
    items = []
    for i, ch in enumerate(chapters):
        active = "active" if i == current_idx else ""
        # Shorten title for nav
        title = ch["title"]
        items.append(
            f'<a href="{CHAPTER_SLUGS[i]}.html" class="nav-item {active}">{html.escape(title)}</a>'
        )
    return "\n".join(items)


def page_html(
    title, content_html, toc_html, nav_html, lang, current_idx, total, en_title, zh_title
):
    other_lang = "zh" if lang == "en" else "en"
    lang_label = "中文" if lang == "en" else "English"
    book_title_en = "Cosmic Grid"
    book_title_zh = "宇宙格点"
    book_title = book_title_en if lang == "en" else book_title_zh
    subtitle_en = "A Unified Framework of Physics, Consciousness, and the Creator"
    subtitle_zh = "物理、意识与造物主的统一框架"
    subtitle = subtitle_en if lang == "en" else subtitle_zh

    prev_link = ""
    next_link = ""
    if current_idx > 0:
        prev_text = "Previous" if lang == "en" else "上一章"
        prev_link = f'<a href="{CHAPTER_SLUGS[current_idx - 1]}.html" class="nav-btn prev">&larr; {prev_text}</a>'
    if current_idx < total - 1:
        next_text = "Next" if lang == "en" else "下一章"
        next_link = f'<a href="{CHAPTER_SLUGS[current_idx + 1]}.html" class="nav-btn next">{next_text} &rarr;</a>'

    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{html.escape(title)} - {book_title}</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-header">
      <a href="index.html" class="book-title">{book_title}</a>
      <p class="book-subtitle">{subtitle}</p>
    </div>
    <nav class="sidebar-nav">
      {nav_html}
    </nav>
  </aside>
  <main class="content">
    <header class="top-bar">
      <button class="menu-toggle" aria-label="Toggle menu">&#9776;</button>
      <div class="lang-switch">
        <a href="{CHAPTER_SLUGS[current_idx]}.html" class="lang-btn {'active' if lang == 'en' else ''}" data-lang="en">EN</a>
        <a href="{CHAPTER_SLUGS[current_idx]}.html" class="lang-btn {'active' if lang == 'zh' else ''}" data-lang="zh">中文</a>
      </div>
    </header>
    <article>
      <h1>{html.escape(title)}</h1>
      {toc_html}
      {content_html}
    </article>
    <nav class="page-nav">
      {prev_link}
      {next_link}
    </nav>
  </main>
</div>
<script src="script.js"></script>
</body>
</html>"""


def index_html(chapters_en, chapters_zh):
    en_items = []
    zh_items = []
    for i, (en, zh) in enumerate(zip(chapters_en, chapters_zh)):
        en_items.append(
            f'<a href="{CHAPTER_SLUGS[i]}.html" class="index-chapter">{html.escape(en["title"])}</a>'
        )
        zh_items.append(
            f'<a href="{CHAPTER_SLUGS[i]}.html" class="index-chapter">{html.escape(zh["title"])}</a>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cosmic Grid / 宇宙格点</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<div class="index-page">
  <div class="index-header">
    <h1 class="index-title" data-en="Cosmic Grid" data-zh="宇宙格点">Cosmic Grid</h1>
    <p class="index-subtitle" data-en="A Unified Framework of Physics, Consciousness, and the Creator" data-zh="物理、意识与造物主的统一框架">A Unified Framework of Physics, Consciousness, and the Creator</p>
    <div class="lang-switch index-lang">
      <a href="#" class="lang-btn active" data-lang="en">EN</a>
      <a href="#" class="lang-btn" data-lang="zh">中文</a>
    </div>
  </div>
  <div class="index-chapters">
    <div class="chapters-en lang-content" data-lang="en">
      {"".join(en_items)}
    </div>
    <div class="chapters-zh lang-content" data-lang="zh" style="display:none">
      {"".join(zh_items)}
    </div>
  </div>
</div>
<script src="script.js"></script>
</body>
</html>"""


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    en_path = os.path.join(script_dir, "CosmicGrid_Complete.docx")
    zh_path = os.path.join(script_dir, "宇宙格点_完整书稿.docx")

    en_chapters = extract_book(en_path, en_chapter_pattern)
    zh_chapters = extract_book(zh_path, zh_chapter_pattern)

    os.makedirs(SITE_DIR, exist_ok=True)

    # Build chapter data for both languages
    chapters_data = {"en": [], "zh": []}
    for i, (en, zh) in enumerate(zip(en_chapters, zh_chapters)):
        en_content = render_content(en["content"])
        en_toc = render_toc(en["content"])
        zh_content = render_content(zh["content"])
        zh_toc = render_toc(zh["content"])
        chapters_data["en"].append(
            {"title": en["title"], "content": en_content, "toc": en_toc}
        )
        chapters_data["zh"].append(
            {"title": zh["title"], "content": zh_content, "toc": zh_toc}
        )

    # Write chapter data as JSON (used by JS for language switching)
    with open(os.path.join(SITE_DIR, "chapters.json"), "w", encoding="utf-8") as f:
        json.dump(chapters_data, f, ensure_ascii=False)

    # Generate chapter HTML pages (default to English)
    for i in range(len(en_chapters)):
        lang = "en"
        nav = build_nav(en_chapters, zh_chapters, i, lang)
        page = page_html(
            chapters_data["en"][i]["title"],
            chapters_data["en"][i]["content"],
            chapters_data["en"][i]["toc"],
            nav,
            lang,
            i,
            len(en_chapters),
            en_chapters[i]["title"],
            zh_chapters[i]["title"],
        )
        with open(
            os.path.join(SITE_DIR, f"{CHAPTER_SLUGS[i]}.html"), "w", encoding="utf-8"
        ) as f:
            f.write(page)

    # Generate index page
    with open(os.path.join(SITE_DIR, "index.html"), "w", encoding="utf-8") as f:
        f.write(index_html(en_chapters, zh_chapters))

    # Copy to public/books/ for Vercel
    if os.path.exists(PUBLIC_BOOKS_DIR):
        shutil.rmtree(PUBLIC_BOOKS_DIR)
    shutil.copytree(SITE_DIR, PUBLIC_BOOKS_DIR)

    print(f"Generated {len(en_chapters)} chapter pages + index in {SITE_DIR}/")
    print(f"Copied to {PUBLIC_BOOKS_DIR}/ for Vercel deployment")


if __name__ == "__main__":
    main()
