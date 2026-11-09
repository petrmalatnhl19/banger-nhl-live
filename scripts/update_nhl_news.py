#!/usr/bin/env python3
"""Publish a link-only NHL news index from official public news pages."""
import json
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from html import unescape
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

class ArticleMeta(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = {}
        self.in_jsonld = False
        self.jsonld = []
        self.blocks = []
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self.in_jsonld = True
            self.jsonld = []
        if tag != "meta":
            return
        key = (attrs.get("property") or attrs.get("name") or "").lower()
        if key in ("article:published_time", "og:title", "og:description", "description"):
            self.values[key] = attrs.get("content", "")
    def handle_data(self, data):
        if self.in_jsonld:
            self.jsonld.append(data)
    def handle_endtag(self, tag):
        if tag == "script" and self.in_jsonld:
            self.blocks.append("".join(self.jsonld))
            self.in_jsonld = False

def fetch_metadata(url):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html"})
    with urlopen(req, timeout=10) as resp:
        content = resp.read(1_500_000).decode("utf-8", "replace")
    parser = ArticleMeta()
    parser.feed(content)
    values = parser.values
    result = {}
    for block in parser.blocks:
        try:
            tree = json.loads(block)
        except (ValueError, TypeError):
            continue
        stack = [tree]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
            elif isinstance(node, dict):
                kind = node.get("@type", [])
                kinds = [kind] if isinstance(kind, str) else kind if isinstance(kind, list) else []
                if any(k in ("NewsArticle", "Article", "BlogPosting") for k in kinds):
                    for source_key, target_key in (("headline", "headline"), ("description", "description"), ("datePublished", "publishedAt")):
                        if isinstance(node.get(source_key), str) and node[source_key].strip():
                            result[target_key] = unescape(node[source_key]).strip()
                stack.extend(v for v in node.values() if isinstance(v, (list, dict)))
    published = result.get("publishedAt") or values.get("article:published_time", "")
    if published:
        try:
            parsed = datetime.fromisoformat(published.replace("Z", "+00:00"))
            if parsed.tzinfo:
                result["publishedAt"] = parsed.isoformat()
        except ValueError:
            pass
    if values.get("og:title") and not result.get("headline"):
        result["headline"] = unescape(values["og:title"]).strip()
    description = values.get("description") or values.get("og:description")
    if description and not result.get("description"):
        result["description"] = unescape(description).strip()
    return result

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
        if len(title) < 15 or len(title) > 190 or url in seen or re.search(r"\\b(betting|wager|odds|props|sázk|kurzy)\\b", title, re.I):
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
    old_by_url = {a.get('url'): a for a in old.get('articles', []) if a.get('url')}
    for language, source in SOURCES:
        try:
            found = load(language, source)
            print(f"{language}: {len(found)} links")
            if found:
                for article in found:
                    previous = old_by_url.get(article['url'], {})
                    article.update({key: previous[key] for key in ('headline', 'description', 'publishedAt') if previous.get(key)})
                    if not article.get('publishedAt') or not article.get('headline'):
                        try:
                            article.update(fetch_metadata(article['url']))
                        except Exception as exc:
                            print(f"Metadata unavailable: {article['url']} ({exc})")
                    articles.append(article)
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
