"""Build a complete current NHL goalie catalog from official roster data.

Starting-goalie projections are optional annotations, never the source of roster coverage.
"""
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROSTERS = ROOT / "nhl_rosters.json"
STARTERS = ROOT / "starting_goalies.json"
OUTPUT = ROOT / "nhl_goalies.json"

def build(rosters, starters):
    teams = rosters.get("teams", {})
    projections = starters.get("teams", {})
    projection_date = starters.get("date")
    result = []
    seen = set()
    for key, team in sorted(teams.items()):
        abbr = team.get("abbrev", "")
        ids = team.get("playerIds", {})
        prediction = projections.get(abbr, {})
        for name in team.get("goalies", []):
            if not name:
                continue
            player_id = ids.get(name)
            identity = player_id if isinstance(player_id, int) else (abbr, name.casefold())
            if identity in seen:
                continue
            seen.add(identity)
            item = {"name": name, "team": abbr, "teamKey": key, "playerId": player_id,
                    "starterStatus": "unknown", "starterGameDate": None}
            # Never assign a projected start to a different goalie or a different date.
            if prediction.get("name", "").casefold() == name.casefold() and prediction.get("date") == projection_date:
                if prediction.get("status") in ("projected", "confirmed"):
                    item["starterStatus"] = prediction["status"]
                    item["starterGameDate"] = projection_date
                    item["starterSource"] = prediction.get("source")
            result.append(item)
    return result

def main():
    with ROSTERS.open(encoding="utf-8") as handle:
        rosters = json.load(handle)
    try:
        with STARTERS.open(encoding="utf-8") as handle:
            starters = json.load(handle)
    except (OSError, ValueError):
        starters = {}
    goalies = build(rosters, starters)
    if len(rosters.get("teams", {})) != 32 or len(goalies) < 32:
        raise SystemExit("Incomplete official NHL goalie rosters; refusing to overwrite catalog")
    payload = {
        "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "rostersUpdatedAt": rosters.get("fetchedAt"),
        "projectionDate": starters.get("date"),
        "teamCount": len(rosters["teams"]),
        "goalieCount": len(goalies),
        "goalies": goalies,
    }
    with OUTPUT.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
    print("Official NHL goalie catalog:", len(goalies), "goalies across", len(rosters["teams"]), "teams")

if __name__ == "__main__":
    main()
