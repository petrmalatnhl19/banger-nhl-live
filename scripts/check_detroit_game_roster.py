#!/usr/bin/env python3
"""Read-only check: were rejected DET projection players in a recent official NHL game?
A past game appearance is evidence of identity, NOT confirmation of the next lineup.
"""
import datetime as dt
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "detroit_game_roster_diagnostic.json"
TARGETS = ("John Leonard",)
def fetch(path):
    req = urllib.request.Request("https://api-web.nhle.com/v1/" + path,
                                 headers={"User-Agent": "BangerNHL/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=12) as response:
        return json.load(response)

def norm(name):
    return "".join(ch for ch in str(name).casefold() if ch.isalpha())

def matches_player(target, box_name):
    parts = str(target).split()
    if len(parts) < 2:
        return norm(target) == norm(box_name)
    compact = str(box_name).replace(".", "").split()
    return (norm(target) == norm(box_name) or
            (len(compact) >= 2 and norm(compact[0]) == norm(parts[0][0]) and
             norm(compact[-1]) == norm(parts[-1])))

def player_names(box, side):
    names = set()
    stats = (box.get("playerByGameStats") or {}).get(side) or {}
    for group in ("forwards", "defense", "goalies"):
        for player in stats.get(group) or []:
            if not isinstance(player, dict):
                continue
            names.add(player.get("name", {}).get("default", "") if isinstance(player.get("name"), dict) else player.get("name", ""))
    return names

today = dt.datetime.now(dt.timezone.utc).date()
result = {"checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(), "team": "DET",
          "scope": "Recent completed NHL games; historical evidence only",
          "players": {name: {"appearedInGames": [], "checkedGames": 0} for name in TARGETS},
          "errors": []}
seen = set()
for days_ago in (0, 7, 14):
    day = today - dt.timedelta(days=days_ago)
    try:
        schedule = fetch("club-schedule-season/DET/now")
        games = schedule.get("games", [])
        break
    except Exception as exc:
        result["errors"].append(f"schedule: {type(exc).__name__}")
        games = []
        break
recent = sorted((g for g in games if str(g.get("gameDate", "")) <= str(today)
                 and g.get("gameState") in ("OFF", "FINAL") and g.get("id")), key=lambda g: g["gameDate"], reverse=True)[:8]
for game in recent:
    gid = game["id"]
    if gid in seen: continue
    seen.add(gid)
    try:
        box = fetch(f"gamecenter/{gid}/boxscore")
        side = "homeTeam" if (box.get("homeTeam") or {}).get("abbrev") == "DET" else "awayTeam"
        names = player_names(box, side)
        for player in TARGETS:
            result["players"][player]["checkedGames"] += 1
            if any(matches_player(player, observed) for observed in names):
                result["players"][player]["appearedInGames"].append({"gameId": gid, "gameDate": game.get("gameDate")})
    except Exception as exc:
        result["errors"].append(f"game {gid}: {type(exc).__name__}")
result["gamesInspected"] = len(seen)
result["nameFieldDiagnostics"] = {"sampleNames": [], "missingNameEntries": 0}
if recent:
    try:
        sample = fetch(f"gamecenter/{recent[0]['id']}/boxscore")
        side = "homeTeam" if (sample.get("homeTeam") or {}).get("abbrev") == "DET" else "awayTeam"
        stats = (sample.get("playerByGameStats") or {}).get(side) or {}
        for group in ("forwards", "defense", "goalies"):
            for p in stats.get(group) or []:
                name = p.get("name") if isinstance(p, dict) else None
                if not name:
                    result["nameFieldDiagnostics"]["missingNameEntries"] += 1
                elif len(result["nameFieldDiagnostics"]["sampleNames"]) < 6:
                    result["nameFieldDiagnostics"]["sampleNames"].append(name)
    except Exception as exc:
        result["errors"].append(f"sample names: {type(exc).__name__}")
result["note"] = "Never automatically approve a projected line based only on historical participation."
OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=False, indent=2))
