#!/usr/bin/env python3
"""Connectivity-only probe. Does not copy, parse, or republish third-party lineups."""
import json
import datetime
import urllib.request
import urllib.error

SOURCES = {
    "between_the_lines": "https://www.betweenthelineshockey.com/tonight.md",
    "fantasy_roundup": "https://www.fsroundup.com/nhl/line-combinations",
}
results = {}
for name, url in SOURCES.items():
    result = {"url": url, "reachable": False, "httpStatus": None,
              "contentType": None, "error": None,
              "automaticReuseAuthorized": False}
    try:
        request = urllib.request.Request(url, headers={
            "User-Agent": "BangerNHL-LineupSourceProbe/1.0",
            "Accept": "text/markdown,text/html;q=0.8,*/*;q=0.2",
        })
        with urllib.request.urlopen(request, timeout=12) as response:
            result["httpStatus"] = response.status
            result["contentType"] = response.headers.get("Content-Type")
            result["reachable"] = response.status == 200
            # Read only a small sample to check connectivity; do not store content.
            response.read(128)
    except urllib.error.HTTPError as exc:
        result["httpStatus"] = exc.code
        result["error"] = "HTTP error"
    except Exception as exc:
        result["error"] = type(exc).__name__
    results[name] = result

report = {
    "checkedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "note": "Reachability does not grant permission to reuse or redistribute data.",
    "sources": results,
}
with open("lineup_free_sources_probe.json", "w", encoding="utf-8") as file:
    json.dump(report, file, ensure_ascii=False, indent=2)
print(json.dumps(report, ensure_ascii=False, indent=2))
