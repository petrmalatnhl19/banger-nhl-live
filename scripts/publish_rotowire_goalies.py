"""Publish schedule-verified RotoWire goalie starts without losing full roster coverage."""
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
def read(name):
    with (ROOT / name).open(encoding="utf-8") as file:
        return json.load(file)

def main():
    diagnostic = read("rotowire_goalies_diagnostic.json")
    catalog = read("nhl_rosters.json")["teams"]
    if diagnostic.get("matchedCount", 0) < 10:
        raise SystemExit("RotoWire coverage too low; preserving existing data")
    names = {team["abbrev"]: {name.casefold() for name in team.get("goalies", [])}
             for team in catalog.values()}
    # NHL roster identity is independent of whether the goalie is confirmed to start.
    ids = {team["abbrev"]: {name.casefold(): str(team.get("playerIds", {}).get(name))
             for name in team.get("goalies", []) if team.get("playerIds", {}).get(name)}
           for team in catalog.values()}
    now = datetime.datetime.now(datetime.timezone.utc)
    today = now.date().isoformat()
    by_game = {}
    for item in diagnostic["matches"]:
        if item["goalie"].casefold() not in names.get(item["team"], set()):
            continue
        if item["date"] < today or item["status"] not in ("confirmed", "projected"):
            continue
        key = (item["date"], item["team"], item["gameId"])
        by_game.setdefault(key, []).append(item)
    valid = []
    conflicts = []
    for key, items in sorted(by_game.items()):
        distinct = {(item["goalie"], item["status"]) for item in items}
        if len(distinct) != 1:
            conflicts.append({"date": key[0], "team": key[1], "gameId": key[2],
                              "reason": "conflicting RotoWire rows"})
            continue
        record = dict(items[0])
        goalie_id = ids.get(record["team"], {}).get(record["goalie"].casefold())
        if goalie_id and goalie_id.isdecimal():
            record["goalieId"] = goalie_id
        # Do not turn a page fetch timestamp into a published confirmation timestamp.
        # Pass through only an explicit timestamp provided for this individual report.
        if record.get("status") == "confirmed" and record.get("sourcePublishedAt"):
            record["confirmationBasis"] = "explicit_pregame_report"
        valid.append(record)
    output = {"updatedAt": now.isoformat(), "source": diagnostic["source"],
              "goalieCount": len(valid), "games": valid, "conflicts": conflicts}
    with (ROOT / "rotowire_goalies.json").open("w", encoding="utf-8") as file:
        json.dump(output, file, ensure_ascii=False, indent=2)
    starters = read("starting_goalies.json")
    if starters.get("date") != today:
        print("Starter feed date mismatch; only future RotoWire feed published")
        return
    entries = starters.setdefault("teams", {})
    for item in valid:
        if item["date"] != today:
            continue
        abbr = item["team"]
        existing = entries.get(abbr)
        # A specialist confirmation takes precedence over a projection.
        # Conflicting unconfirmed projections are suppressed, not guessed.
        if existing and existing["name"].casefold() != item["goalie"].casefold() and item["status"] != "confirmed":
            entries.pop(abbr, None)
            conflicts.append({"date": today, "team": abbr, "reason": "source disagreement",
                              "rotowire": item["goalie"], "previous": existing["name"]})
            continue
        entries[abbr] = {"name": item["goalie"], "status": item["status"],
                         "date": today, "source": diagnostic["source"],
                         "sourceLabel": "RotoWire", "checkedAt": now.isoformat(),
                         "gameId": item["gameId"]}
    confirmed_teams = {item["team"] for item in valid if item["date"] == today and item["status"] == "confirmed"}
    # A verified confirmation resolves older projection disagreements for that team.
    starters["conflicts"] = [issue for issue in starters.get("conflicts", [])
                             if issue.get("team") not in confirmed_teams] + conflicts
    starters["updatedAt"] = now.isoformat()
    starters["status"] = "partial" if starters.get("conflicts") or starters.get("sourceErrors") else "ok"
    with (ROOT / "starting_goalies.json").open("w", encoding="utf-8") as file:
        json.dump(starters, file, ensure_ascii=False, indent=2)
    print("RotoWire verified future/current starts:", len(valid), "today:", sum(x["date"] == today for x in valid))

if __name__ == "__main__":
    main()
