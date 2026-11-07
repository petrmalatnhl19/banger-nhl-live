#!/usr/bin/env python3
"""Archive a bounded, timestamped MoneyPuck goalie season-summary snapshot.
A downloaded snapshot is for FUTURE predictions only, never historical backfill.
"""
import csv
import hashlib
import io
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://moneypuck.com/moneypuck/playerData/seasonSummary/2026/regular/goalies.csv"
MAX_BYTES = 4_000_000
REQUIRED = {"playerId", "situation", "xGoals", "goals", "ongoal"}

def main():
    req = urllib.request.Request(URL, headers={"User-Agent": "BangerNHLResearch/0.2"})
    with urllib.request.urlopen(req, timeout=35) as response:
        payload = response.read(MAX_BYTES + 1)
        last_modified = response.headers.get("Last-Modified")
    if len(payload) > MAX_BYTES:
        raise ValueError("Unexpectedly large CSV")
    text = payload.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    fields = reader.fieldnames or []
    if len(fields) != len(set(fields)) or not REQUIRED.issubset(fields):
        raise ValueError("Unverified goalie CSV columns: " + repr(fields))
    count = 0
    for row in reader:
        count += 1
        if not row.get("playerId") or not row.get("situation"):
            raise ValueError("Invalid goalie identity or situation")
        for key in ("xGoals", "goals", "ongoal"):
            try:
                if float(row[key]) < 0:
                    raise ValueError("Negative statistic")
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid {key} on row {count}") from exc
    if not count:
        raise ValueError("Empty goalie CSV")
    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%SZ")
    target = Path("diagnostics") / "core43-goalie-snapshots" / stamp
    target.mkdir(parents=True, exist_ok=False)
    (target / "goalies.csv").write_bytes(payload)
    metadata = {
        "source": URL,
        "fetchedAt": now.isoformat(),
        "lastModified": last_modified,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "rows": count,
        "columns": fields,
        "historicalUsage": "Only games with kickoff strictly AFTER fetchedAt",
        "status": "archived_snapshot_not_model_integrated",
    }
    (target / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps({"fetchedAt": metadata["fetchedAt"], "rows": count, "sha256": metadata["sha256"]}))

if __name__ == "__main__":
    main()
