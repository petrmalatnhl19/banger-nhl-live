#!/usr/bin/env python3
"""Publish a link-only NHL news index from official public news pages."""
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

ROOT = "https://www.nhl.com"
SOURCES = [("cs", ROOT + "/cs/news/"), ("en", ROOT + "/news/")]

class NewsLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.href = None
        self.parts = []
        self.items = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href", "")
            self.parts = []
    def handle_data(self, data):
        if self.href is not None:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag != "a" or self.href is None:
            return
        title = re.sub(r"\s+", " ", " ".join(self.parts)).strip()
        self.items.append((self.href, title))
        self.href = None
        self.parts = []

def load(language, source):
    req = Request(source, headers={"User-Agent": "Mozilla/5.0 (compatible; BangerNHLNews/1.0)", "Accept": "text/html"})
    with urlopen(req, timeout=18) as resp:
        html = resp.read(4_000_000).decode("utf-8", "replace")
    parser = NewsLinks()
    parser.feed(html)
    out = []
    seen = set()
    for href, title in parser.items:
        url = urljoin(source, href).split("#")[0].split("?")[0]
        parsed = urlparse(url)
        if parsed.netloc not in ("www.nhl.com", "nhl.com"):
            continue
        prefix = "/cs/news/" if language == "cs" else "/news/"
        if not parsed.path.startswith(prefix) or parsed.path == prefix:
            continue
        if len(title) < 15 or len(title) > 190 or url in seen:
            continue
        seen.add(url)
        out.append({"title": title, "url": url, "language": language, "source": "NHL.com"})
        if len(out) >= 40:
            break
    return out

def main():
    path = Path("nhl_news.json")
    old = {}
    if path.exists():
        try:
            old = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            pass
    articles = []
    for language, source in SOURCES:
        try:
            found = load(language, source)
            print(f"{language}: {len(found)} links")
            if found:
                articles.extend(found)
            else:
                articles.extend(a for a in old.get("articles", []) if a.get("language") == language)
        except Exception as exc:
            print(f"{language}: source unavailable ({exc})")
            articles.extend(a for a in old.get("articles", []) if a.get("language") == language)
    if not articles:
        print("No articles; preserving existing file")
        return
    data = {"updatedAt": datetime.now(timezone.utc).isoformat(), "articles": articles[:80]}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Published {len(data['articles'])} article links")

if __name__ == "__main__":
    main()
