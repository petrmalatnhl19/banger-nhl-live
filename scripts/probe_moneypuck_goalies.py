#!/usr/bin/env python3
"""Read only the header of MoneyPuck's published goalie CSV and emit a diagnostic.
Does not scrape pages or change production forecasts.
"""
import csv
import io
import json
import os
import urllib.request
from datetime import datetime, timezone

URL = "https://moneypuck.com/moneypuck/playerData/seasonSummary/2026/regular/goalies.csv"
EXPECTED = ("playerId", "name", "situation", "xGoals", "goals")
def main():
    request = urllib.request.Request(URL, headers={"User-Agent": "BangerNHLResearch/0.1 (published CSV only)"})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read(2_000_000 + 1)
        if len(data) > 2_000_000:
            raise ValueError("CSV exceeds safety limit")
        updated = response.headers.get("Last-Modified")
    decoded = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))
    headers = reader.fieldnames or []
    if not headers or len(headers) != len(set(headers)):
        raise ValueError("Missing or duplicate CSV columns")
    report = {
        "source": URL,
        "checkedAtUTC": datetime.now(timezone.utc).isoformat(),
        "httpLastModified": updated,
        "headers": headers,
        "suggestedFieldPresence": {key: key in headers for key in EXPECTED},
        "sampleRowCount": sum(1 for _, row in zip(range(3), reader)),
        "status": "schema_observed_only_not_live_integrated",
        "note": "Season summary rows are not game-level snapshots. Never backfill pregame predictions using later CSV data."
    }
    os.makedirs("diagnostics", exist_ok=True)
    with open("diagnostics/core43-moneypuck-goalies-schema.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
