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
              "eligible_evidence_candidates": 0, "invalid_timestamp": 0,
              "blocked_by_reason": {}}
    now = dt.datetime.now(dt.timezone.utc)
    for row in data.get("games", []):
        result["total"] += 1
        status = row.get("status")
        if status == "projected":
            result["projected"] += 1
        if status != "confirmed":
            reason = "not_confirmed"
            result["blocked_by_reason"][reason] = result["blocked_by_reason"].get(reason, 0) + 1
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
                valid_time = parsed <= now
            except ValueError:
                pass
        if published and not valid_time:
            result["invalid_timestamp"] += 1
        if valid_time:
            result["confirmed_with_published_at"] += 1
        # One exclusive reason per rejected record; this is a local source audit,
        # not proof that the report passed the downstream schedule/URL checks.
        if not has_id:
            reason = "missing_goalie_id"
        elif not published:
            reason = "missing_source_publication_time"
        elif not valid_time:
            reason = "invalid_or_future_publication_time"
        elif row.get("confirmationBasis") != "explicit_pregame_report":
            reason = "missing_explicit_confirmation_basis"
        elif not isinstance(row.get("gameId"), int) or isinstance(row.get("gameId"), bool):
            reason = "missing_game_id"
        else:
            result["eligible_evidence_candidates"] += 1
            continue
        result["blocked_by_reason"][reason] = result["blocked_by_reason"].get(reason, 0) + 1
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
            if counts["total"] and counts["projected"] == counts["total"]:
                out.write("**Projection-only source:** all parsed rows are projected; no confirmed starters can enter CORE 4.3 from this snapshot.\n")
    if counts["total"] and counts["projected"] == counts["total"]:
        print("::warning title=CORE 4.3 projection-only RotoWire snapshot::All parsed rows are projected, so this run cannot supply verified pregame starter evidence")
    if counts["confirmed"] and not counts["eligible_evidence_candidates"]:
        print("::warning title=CORE 4.3 evidence gap::Confirmed goalie statuses exist, but no records have all required individual evidence metadata")

if __name__ == "__main__":
    main()
