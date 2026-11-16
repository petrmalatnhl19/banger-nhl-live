"""Collect official postgame outcomes and public, frozen prediction rows using GET."""
import argparse
import concurrent.futures
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from audit_official_final_goalies import BASE, fetch_json, final_goalies

ARCHIVE = "nhl_prediction_archive"
SCHEDULE = "nhl_core43_public_schedule_evidence"
FINAL = ("FINAL", "OFF")
MODELS = ("core40", "core41", "core42")
ZONES = dict(EST=-5, EDT=-4, CST=-6, CDT=-5, MST=-7, MDT=-6,
             PST=-8, PDT=-7, AST=-4, ADT=-3, EET=2, EEST=3)
ZONE_ALIASES = {"ABT": (-7, -6), "MBT": (-6, -5), "PCT": (-8, -7)}


def instant(text):
    value = datetime.fromisoformat(text.replace("Z", "+00:00"))
    if value.utcoffset() is None:
        raise ValueError("timezone required")
    return value.astimezone(timezone.utc)


def selection(end, days, count, cutoff, fetch=fetch_json):
    """Choose chronologically before examining forecast coverage or accuracy."""
    games = {}
    for offset in range(days):
        day = (end - timedelta(days=offset)).isoformat()
        for game in fetch("score/" + day)["games"]:
            if (game["gameType"] != 2 or game["gameDate"] != day
                    or instant(game["startTimeUTC"]) >= cutoff):
                continue
            key = game["id"]
            if key in games and games[key] != game:
                raise ValueError(f"conflicting NHL schedule for {key}")
            games[key] = game
    return sorted(games.values(), key=lambda game: (
        instant(game["startTimeUTC"]), game["id"]), reverse=True)[:count]


def source_bytes(url):
    with urlopen(Request(url, headers={"User-Agent": "BangerNHLResearch/0.4"}), timeout=20) as response:
        if response.geturl() != url:
            raise ValueError("unexpected schedule report redirect")
        raw = response.read(3_000_001)
    if len(raw) > 3_000_000:
        raise ValueError("NHL report exceeded limit")
    return raw


def actual_start(html, box):
    """Match the final Game Summary header to boxscore, at minute precision.

    The report uses a 12-hour clock without AM/PM. Accept a unique reading
    within three hours of the official scheduled start in the venue timezone.
    """
    headers = re.findall(r'<table\b[^>]*\bid="(Visitor|GameInfo|Home)"[^>]*>(.*?)</table>',
                         html, re.IGNORECASE | re.DOTALL)
    if sorted(name.lower() for name, _ in headers) != ["gameinfo", "home", "visitor"]:
        raise ValueError("unknown Game Summary layout")
    sections = {name.lower(): body for name, body in headers}
    for name, side in (("visitor", "awayTeam"), ("home", "homeTeam")):
        badges = re.findall(r"\blogoc([a-z]{3})\.gif", sections[name], re.IGNORECASE)
        if [code.upper() for code in badges if code.upper() != "NHL"] != [box[side]["abbrev"]]:
            raise ValueError("Game Summary teams do not match")
    info = sections["gameinfo"].replace("&nbsp;", " ")
    cells = re.findall(r"<td\b[^>]*>\s*([^<>]*?)\s*</td>", info)
    match = re.findall(r"^Start (1[0-2]|[1-9]):([0-5]\d) ([A-Z]{3}); End \d{1,2}:\d{2} \3$", "\n".join(cells), re.M)
    if len(match) != 1 or not {"Game Summary", "Final", f"Game {str(box['id'])[-4:]}"}.issubset(cells):
        raise ValueError("Game Summary identity or start unavailable")
    hour, minute, zone = match[0]
    allowed = ZONE_ALIASES.get(zone, (ZONES[zone],) if zone in ZONES else ())
    offset = box.get("venueUTCOffset")
    offsets = {f"{delta:+03d}:00": delta for delta in allowed}
    if offset not in offsets:
        raise ValueError("unknown or inconsistent Game Summary timezone")
    tz = timezone(timedelta(hours=offsets[offset]))
    scheduled = instant(box["startTimeUTC"]).astimezone(tz)
    if scheduled.strftime("%A, %B ") + str(scheduled.day) + scheduled.strftime(", %Y") not in cells:
        raise ValueError("Game Summary date does not match")
    candidates = [scheduled.replace(hour=int(hour) % 12 + shift, minute=int(minute), second=0, microsecond=0)
                  for shift in (0, 12)]
    near = [value for value in candidates if abs(value - scheduled) <= timedelta(hours=3)]
    if len(near) != 1:
        raise ValueError("ambiguous Game Summary clock")
    return near[0].astimezone(timezone.utc).isoformat()


def normalize(score, box):
    match_fields = ("id", "gameDate", "startTimeUTC", "gameType")
    if any(score[key] != box[key] for key in match_fields) or box["gameState"] not in FINAL:
        raise ValueError("NHL score and final boxscore identity mismatch")
    for side in ("awayTeam", "homeTeam"):
        if any(score[side][key] != box[side][key] for key in ("id", "abbrev", "score")):
            raise ValueError("NHL score and boxscore teams or goals disagree")
    if box["awayTeam"]["id"] == box["homeTeam"]["id"]:
        raise ValueError("NHL team identities are equal")
    ending = score["gameOutcome"]["lastPeriodType"]
    if ending != box["periodDescriptor"]["periodType"] or ending not in ("REG", "OT", "SO"):
        raise ValueError("NHL score and boxscore end type disagree")
    final = {side: box[side + "Team"]["score"] for side in ("away", "home")}
    if any(type(n) is not int or n < 0 for n in final.values()) or final["away"] == final["home"]:
        raise ValueError("invalid NHL final result")
    regulation = final.copy()
    if ending in ("SO", "OT"):
        # Regular season only: the winning OT or SO is one goal in the official score.
        regulation[max(final, key=final.get)] -= 1
        if regulation["away"] != regulation["home"]:
            raise ValueError("extra-time game must be tied after regulation")
    played_goals = regulation if ending == "SO" else final
    goalies = final_goalies(box)
    return {
        "id": str(box["id"]), "date": box["gameDate"], "scheduledAt": box["startTimeUTC"],
        "scheduledUtcDate": instant(box["startTimeUTC"]).date().isoformat(),
        "away": box["awayTeam"]["abbrev"], "home": box["homeTeam"]["abbrev"],
        "final": final, "regulation": regulation, "playedGoals": played_goals, "ending": ending,
        "postgameGoalies": {side.lower().replace("team", ""): {
            "starterId": row["startingGoalieId"],
            "participants": [p for p in row["participants"] if p["starter"] is True
                             or p["toi"] not in (None, "", "00:00", "0:00")]
        } for side, row in goalies.items()},
    }


def retry(call, *args):
    for attempt in range(3):
        try:
            return call(*args)
        except HTTPError as error:
            if attempt == 2 or error.code not in (429, 500, 502, 503, 504):
                raise
        except (TimeoutError, URLError):
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


def collect_game(score):
    game_id = str(score["id"])
    if score["gameState"] not in FINAL:
        return None, {"gameId": game_id, "reason": "nhl_game_not_final"}
    season = score["season"]
    box_path = f"gamecenter/{game_id}/boxscore"
    summary = f"https://www.nhl.com/scores/htmlreports/{season}/GS{game_id[4:]}.HTM"
    try:
        box = retry(fetch_json, box_path)
        game = normalize(score, box)
    except (OSError, KeyError, ValueError, TypeError) as error:
        return None, {"gameId": game_id, "reason": "nhl_boxscore_unavailable_or_invalid", "detail": str(error)}
    game["sources"] = {"score": BASE + "score/" + game["date"], "boxscore": BASE + box_path,
                       "gameSummary": summary, "retrievedAt": datetime.now(timezone.utc).isoformat()}
    game["actualStartAt"] = None
    try:
        raw = retry(source_bytes, summary)
        game["actualStartAt"] = actual_start(raw.decode(), box)
        game["sources"]["gameSummarySha256"] = hashlib.sha256(raw).hexdigest()
        game["sources"]["startPrecision"] = "minute"
    except (OSError, KeyError, ValueError, TypeError) as error:
        return game, {"gameId": game_id, "reason": "actual_start_unavailable", "detail": str(error)}
    return game, None


def archive_rows(ids):
    # Reuse the public REST endpoint and publishable key already used by the app.
    client = (ROOT / "core-performance.js").read_text()
    root = re.search(r"const ROOT='([^']+)'", client)[1]
    apikey = re.search(r"const APIKEY='([^']+)'", client)[1]
    columns = "game_id,game_date,away_team,home_team," + ",".join(
        f"{model}_{field}" for model in MODELS for field in ("away", "home", "version", "predicted_at", "factors"))
    results = ([], [])
    for start in range(0, len(ids), 35):
        batch = ids[start:start + 35]
        for target, table, fields in zip(results, (ARCHIVE, SCHEDULE),
                                         (columns, "game_id,away_team,home_team,kickoff_at")):
            query = urlencode({"game_id": "in.(" + ",".join(batch) + ")", "select": fields, "limit": 1000})
            request = Request(root + table + "?" + query, headers={"apikey": apikey})
            with urlopen(request, timeout=25) as response:
                rows = json.load(response)
            if not isinstance(rows, list) or len(rows) >= 1000:
                raise ValueError("incomplete public archive read")
            target.extend(rows)
    return results


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--end", type=date.fromisoformat, required=True, help="Last NHL calendar date")
    cli.add_argument("--cutoff", type=instant, required=True, help="Only scheduled starts earlier than this UTC instant")
    cli.add_argument("--days", type=int, default=15)
    cli.add_argument("--count", type=int, default=100)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    if not 1 <= args.days <= 31 or not 1 <= args.count <= 1000:
        cli.error("use 1–31 days and 1–1000 games")
    chosen = selection(args.end, args.days, args.count, args.cutoff, lambda path: retry(fetch_json, path))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        results = list(executor.map(collect_game, chosen))
    games = [game for game, _ in results if game]
    issues = [issue for _, issue in results if issue]
    ids = [str(game["id"]) for game in chosen]
    archive, schedules = archive_rows(ids)
    scope = {"policy": "latest_scheduled_regular_season_before_cutoff", "requested": args.count,
             "end": args.end.isoformat(), "days": args.days, "cutoff": args.cutoff.isoformat(), "selectedIds": ids,
             "purpose": "pilot", "archiveRetrievedAt": datetime.now(timezone.utc).isoformat()}
    with args.output.open("x") as output:
        json.dump({"scope": scope, "games": games, "archive": archive, "schedules": schedules, "issues": issues},
                  output, ensure_ascii=False, allow_nan=False)
    print(f"Selected {len(chosen)}, normalized {len(games)}, archive rows {len(archive)}, collection issues {len(issues)}")


if __name__ == "__main__":
    main()
