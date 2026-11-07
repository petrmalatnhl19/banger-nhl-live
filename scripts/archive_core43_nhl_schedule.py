#!/usr/bin/env python3
"""CORE 4.3: archive official NHL kickoff times and goalie identity evidence.

The NHL schedule API provides game IDs and exact UTC start times. A scheduled
match does NOT confirm starting goalies. This script intentionally leaves
starter IDs null unless a separate verified source is implemented.
"""
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://api-web.nhle.com/v1/schedule/"
MAX_BYTES = 2_000_000

def fetch_day(day):
    req = urllib.request.Request(BASE + day, headers={"User-Agent": "BangerNHLResearch/0.3"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("NHL response too large")
    return json.loads(data)

def normalize(payload):
    games = []
    for week in payload.get("gameWeek", []):
        for g in week.get("games", []):
            if g.get("gameType") != 2:
                continue
            game_id, start = g.get("id"), g.get("startTimeUTC")
            away, home = (g.get("awayTeam") or {}).get("abbrev"), (g.get("homeTeam") or {}).get("abbrev")
            if not isinstance(game_id, int) or not start or not away or not home:
                continue
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            if dt.utcoffset() != timedelta(0):
                raise ValueError("Expected UTC kickoff")
            games.append({
                "gameId": game_id, "kickoffUTC": dt.isoformat().replace("+00:00", "Z"),
                "awayTeam": away, "homeTeam": home,
                "awayStartingGoalieId": None, "homeStartingGoalieId": None,
                "goalieConfirmation": "unverified",
                "source": "official_nhl_schedule",
            })
    return games

def main():
    today = datetime.now(timezone.utc).date()
    found = {}
    for offset in (0, 7):
        day = (today + timedelta(days=offset)).isoformat()
        for g in normalize(fetch_day(day)):
            if g["gameId"] in found and found[g["gameId"]] != g:
                raise ValueError("Conflicting NHL schedule records")
            found[g["gameId"]] = g
    snapshot = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "status": "schedule_only_no_confirmed_goalies",
        "games": sorted(found.values(), key=lambda g: (g["kickoffUTC"], g["gameId"])),
    }
    target = Path("diagnostics/core43-nhl-schedule.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"games": len(found), "goalieConfirmations": 0, "output": str(target)}))

if __name__ == "__main__":
    main()
