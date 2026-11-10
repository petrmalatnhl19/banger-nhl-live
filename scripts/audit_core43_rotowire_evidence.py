#!/usr/bin/env python3
"""Audit provenance of RotoWire starter records without promoting predictions."""
import datetime as dt
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def audit(data):
    result = {"total": 0, "projected": 0, "confirmed": 0,
              "confirmed_with_nhl_id": 0, "confirmed_with_published_at": 0,
              "eligible_evidence_candidates": 0, "invalid_timestamp": 0}
    for row in data.get("games", []):
        result["total"] += 1
        status = row.get("status")
        if status == "projected":
            result["projected"] += 1
        if status != "confirmed":
            continue
        result["confirmed"] += 1
        has_id = bool(re.fullmatch(r"[0-9]+", str(row.get("goalieId") or "")))
        if has_id:
            result["confirmed_with_nhl_id"] += 1
        published = row.get("sourcePublishedAt")
        valid_time = False
        if isinstance(published, str) and published.endswith("Z"):
            try:
                parsed = dt.datetime.fromisoformat(published.replace("Z", "+00:00"))
                valid_time = parsed <= dt.datetime.now(dt.timezone.utc)
            except ValueError:
                pass
        if published and not valid_time:
            result["invalid_timestamp"] += 1
        if valid_time:
            result["confirmed_with_published_at"] += 1
        if (has_id and valid_time and row.get("confirmationBasis") == "explicit_pregame_report"
                and isinstance(row.get("gameId"), int)):
            result["eligible_evidence_candidates"] += 1
    return result

def main():
    data = json.loads((ROOT / "rotowire_goalies.json").read_text(encoding="utf-8"))
    counts = audit(data)
    print("CORE 4.3 RotoWire evidence provenance: " + json.dumps(counts, sort_keys=True))
    summary = Path(__import__("os").environ.get("GITHUB_STEP_SUMMARY", ""))
    if summary.is_file():
        with summary.open("a", encoding="utf-8") as out:
            out.write("\n### CORE 4.3 RotoWire evidence coverage\n")
            for key, value in counts.items():
                out.write(f"- {key}: {value}\n")
            if not counts["eligible_evidence_candidates"]:
                out.write("**No eligible verified starter evidence.** A snapshot check time is not a source publication time.\n")
    if counts["confirmed"] and not counts["eligible_evidence_candidates"]:
        print("::warning title=CORE 4.3 evidence gap::Confirmed goalie statuses exist, but no records have all required individual evidence metadata")

if __name__ == "__main__":
    main()
