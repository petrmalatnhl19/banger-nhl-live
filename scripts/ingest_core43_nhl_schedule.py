#!/usr/bin/env python3
"""Store official NHL schedule observations using server-side GitHub secrets."""
import json
import os
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

def main():
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Schedule ingest skipped: Supabase secrets unavailable")
        return
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or not parsed.hostname.endswith(".supabase.co") or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("Unexpected Supabase URL")
    snapshot = json.loads(Path("diagnostics/core43-nhl-schedule.json").read_text(encoding="utf-8"))
    if snapshot.get("status") != "schedule_only_no_confirmed_goalies":
        raise ValueError("Unexpected schedule source")
    fetched_at = snapshot["fetchedAt"]
    payload = []
    for g in snapshot["games"]:
        if g["awayStartingGoalieId"] is not None or g["homeStartingGoalieId"] is not None:
            raise ValueError("Schedule cannot verify starting goalies")
        payload.append({
            "game_id": g["gameId"], "fetched_at": fetched_at,
            "kickoff_at": g["kickoffUTC"], "away_team": g["awayTeam"],
            "home_team": g["homeTeam"], "source": "official_nhl_schedule",
        })
    if not payload:
        raise ValueError("No NHL games to archive")
    request = urllib.request.Request(
        url + "/rest/v1/nhl_core43_schedule_snapshots?on_conflict=game_id,fetched_at",
        data=json.dumps(payload).encode("utf-8"), method="POST",
        headers={"apikey":key,"Authorization":"Bearer "+key,
                 "Content-Type":"application/json",
                 "Prefer":"resolution=ignore-duplicates,return=minimal"})
    with urllib.request.urlopen(request,timeout=45) as response:
        if response.status not in (200,201,204):
            raise RuntimeError("Schedule insert failed")
    print(f"Stored {len(payload)} official NHL schedule observations")

if __name__ == "__main__":
    main()
