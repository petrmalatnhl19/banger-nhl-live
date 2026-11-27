"""Inspect public source metadata without publishing or database access."""
import datetime as dt
import json
import re
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit
from scripts import parse_rotowire_goalies as parser

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.blocks = []
        self.active = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.active = True
            self.blocks.append("")
    def handle_data(self, data):
        if self.active:
            self.blocks[-1] += data
    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

def articles(value):
    if isinstance(value, list):
        for item in value:
            yield from articles(item)
    elif isinstance(value, dict):
        kind = value.get("@type", [])
        if kind == "NewsArticle" or isinstance(kind, list) and "NewsArticle" in kind:
            yield value
        yield from articles(value.get("@graph"))

def links(doc):
    for href in doc.links:
        url = urljoin(parser.NEWS, href)
        parts = urlsplit(url)
        if parts.scheme == "https" and parts.netloc == "www.rotowire.com" and re.fullmatch(r"/hockey/headlines/[a-z0-9-]+-\d+", parts.path):
            yield url

def main():
    observed = dt.datetime.now(dt.timezone.utc)
    rosters = json.loads((parser.ROOT / "nhl_rosters.json").read_text())["teams"]
    schedule = json.loads(parser.load("https://api-web.nhle.com/v1/schedule/" + observed.date().isoformat()))
    rows = parser.match_schedule(parser.extract(parser.load(parser.URL), rosters), schedule)
    index = Document()
    index.feed(parser.load(parser.NEWS))
    urls = list(dict.fromkeys(links(index)))
    print(json.dumps({"observed": observed.isoformat(), "rows": len(rows), "confirmed": sum(r["status"] == "confirmed" for r in rows), "article_links": len(urls)}))
    names = {}
    for day in schedule.get("gameWeek", []):
        for game in day.get("games", []):
            for side in ("homeTeam", "awayTeam"):
                team = game[side]
                names[team["abbrev"]] = [team.get(k, {}).get("default") for k in ("commonName", "placeName") if team.get(k, {}).get("default")]
    for url in urls[:40]:
        doc = Document()
        try:
            doc.feed(parser.load(url))
        except (OSError, TimeoutError) as exc:
            print(json.dumps({"url": url, "error": type(exc).__name__}))
            continue
        found = 0
        for block in doc.blocks:
            try:
                data = json.loads(block)
            except ValueError:
                print(json.dumps({"url": url, "reason": "invalid_json_ld"}))
                continue
            for article in articles(data):
                found += 1
                about = article.get("about")
                name = about.get("name") if isinstance(about, dict) else None
                matches = []
                for row in rows:
                    slug = "-".join(parser.norm(w) for w in row["goalie"].split())
                    if name != row["goalie"] and not urlsplit(url).path.startswith("/hockey/headlines/" + slug + "-"):
                        continue
                    result = parser.match_report(article, row, names.get(row["opponent"], []), observed)
                    matches.append({"gameId": row["gameId"], "team": row["team"], "goalie": row["goalie"], "status": row["status"], "start": row["startTimeUTC"], "opponent": row["opponent"], "opponent_names": names.get(row["opponent"], []), "venue": row["venue"], "date": row["date"], "parser_accepts": bool(result)})
                print(json.dumps({"url": url, "type": article.get("@type"), "about": about, "datePublished": article.get("datePublished"), "dateModified": article.get("dateModified"), "headline": article.get("headline"), "description": article.get("description") if any(m["status"] == "confirmed" for m in matches) else None, "matches": matches}, ensure_ascii=False))
        if not found:
            print(json.dumps({"url": url, "reason": "no_news_article", "json_ld_blocks": len(doc.blocks)}))

if __name__ == "__main__":
    main()
