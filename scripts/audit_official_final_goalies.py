#!/usr/bin/env python3
"""Read-only official NHL final-game goalie audit; never changes prediction archives."""
import argparse
import json
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE = "https://api-web.nhle.com/v1/"
MAX_BYTES = 3_000_000

def fetch_json(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "BangerNHLResearch/0.4"})
    with urllib.request.urlopen(req, timeout=25) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise ValueError("NHL response exceeded limit")
    return json.loads(raw)

def final_goalies(box):
    """Only explicitly final games; identify actual participants, not inferred starters."""
    if box.get("gameState") not in ("OFF", "FINAL"):
        return None
    stats = box.get("playerByGameStats") or {}
    result = {}
    for side in ("awayTeam", "homeTeam"):
        team = box.get(side) or {}
        abbrev = team.get("abbrev")
        rows = (stats.get(side) or {}).get("goalies") or []
        players = []
        for g in rows:
            if not isinstance(g, dict) or not isinstance(g.get("playerId"), int):
                continue
            name = g.get("name") or {}
            if isinstance(name, dict):
                name = name.get("default", "")
            players.append({
                "playerId": g["playerId"],
                "name": name if isinstance(name, str) else "",
                "starter": g.get("starter") if isinstance(g.get("starter"), bool) else None,
                "toi": g.get("toi"),
            })
        explicit = [p for p in players if p["starter"] is True]
        result[side] = {"team": abbrev, "participants": players,
                        "startingGoalieId": explicit[0]["playerId"] if len(explicit) == 1 else None,
                        "starterVerified": len(explicit) == 1}
    return result

def collect(days=10, now=None, fetch=fetch_json):
    now = now or datetime.now(timezone.utc)
    game_ids = set()
    for offset in range(days):
        date = (now.date() - timedelta(days=offset)).isoformat()
        schedule = fetch("schedule/" + date)
        for week in schedule.get("gameWeek", []):
            for g in week.get("games", []):
                if g.get("gameType") == 2 and isinstance(g.get("id"), int):
                    start = g.get("startTimeUTC")
                    if start:
                        try:
                            if datetime.fromisoformat(start.replace("Z", "+00:00")) > now:
                                continue
                        except ValueError:
                            continue
                    game_ids.add(g["id"])
    games = []
    failures = []
    for game_id in sorted(game_ids):
        try:
            box = fetch(f"gamecenter/{game_id}/boxscore")
            result = final_goalies(box)
            if result is None:
                continue
            games.append({"gameId": game_id, "gameDate": box.get("gameDate"),
                          "away": result["awayTeam"], "home": result["homeTeam"],
                          "sourceUrl": f"https://www.nhl.com/gamecenter/{game_id}/boxscore"})
        except (ValueError, KeyError, OSError, TimeoutError) as exc:
            failures.append({"gameId": game_id, "errorType": type(exc).__name__})
    return {"generatedAt": now.isoformat(), "source": "official_nhl_final_boxscore",
            "historicalPredictionMutation": False, "games": games, "failures": failures,
            "summary": {"finalGames": len(games),
                        "withBothVerifiedStarters": sum(g["away"]["starterVerified"] and g["home"]["starterVerified"] for g in games),
                        "withBothGoalieParticipants": sum(bool(g["away"]["participants"]) and bool(g["home"]["participants"]) for g in games),
                        "fetchFailures": len(failures)}}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--days", type=int, default=10)
    parser.add_argument("--output", default="diagnostics/official-final-goalies.json")
    args = parser.parse_args()
    if not 1 <= args.days <= 30:
        parser.error("--days must be 1..30")
    result = collect(args.days)
    path = Path(args.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["summary"]))

if __name__ == "__main__":
    main()
