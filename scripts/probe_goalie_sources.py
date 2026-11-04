"""Non-destructive probe of public NHL goalie source pages.

Run: python scripts/probe_goalie_sources.py
Does not modify starting_goalies.json or any app data.
"""
import datetime
import json
import re
import urllib.error
import urllib.request
from html.parser import HTMLParser

SOURCES = {
    "rotowire": "https://www.rotowire.com/hockey/starting-goalies.php?view=teams",
    "rotoballer": "https://www.rotoballer.com/nhl-starting-goalies",
}

class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.hidden += 1
        if tag in ("p", "div", "tr", "td", "h1", "h2", "h3", "li", "br"):
            self.parts.append(" ")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("p", "div", "tr", "td", "h1", "h2", "h3", "li"):
            self.parts.append(" ")
    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

def probe(name, url):
    result = {"source": name, "url": url, "ok": False}
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 (compatible; NHL source availability check)",
            "Accept": "text/html",
        })
        with urllib.request.urlopen(req, timeout=18) as response:
            raw = response.read(1500000)
            result["httpStatus"] = response.status
            result["contentType"] = response.headers.get("Content-Type", "")
        page = raw.decode("utf-8", "replace")
        parser = Text()
        parser.feed(page)
        text = re.sub(r"\\s+", " ", " ".join(parser.parts))
        result["bytes"] = len(raw)
        result["visibleTextLength"] = len(text)
        result["hasGoalieTerms"] = bool(re.search(r"starting goalies|projected.*goalie", text, re.I))
        result["hasStatusLabels"] = {
            label: bool(re.search(r"\\b" + label + r"\\b", text, re.I))
            for label in ("Confirmed", "Expected", "Projected", "Unknown")
        }
        result["ok"] = result["httpStatus"] == 200
        result["note"] = "Availability only; labels may be explanations, not game records."
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        result["error"] = type(error).__name__ + ": " + str(error)[:180]
    return result

if __name__ == "__main__":
    report = {
        "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "results": [probe(name, url) for name, url in SOURCES.items()],
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
