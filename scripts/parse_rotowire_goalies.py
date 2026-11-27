"""Read RotoWire team-view goalie projections into a diagnostic JSON file.

No production predictions are modified. Match each record against official
NHL roster names and NHL schedule before accepting it.
"""
import datetime
import html
import json
import re
import urllib.request
from urllib.error import URLError
from zoneinfo import ZoneInfo
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

try:
    from scripts.data_13_game_identity import validate_game_claims
except ModuleNotFoundError as exc:
    if exc.name != "scripts":
        raise
    from data_13_game_identity import validate_game_claims

ROOT = Path(__file__).resolve().parent.parent
URL = "https://www.rotowire.com/hockey/starting-goalies.php?view=teams"
TEAMS = re.compile(r"^(ANA|BOS|BUF|CAR|CBJ|CGY|CHI|COL|DAL|DET|EDM|FLA|LAK|MIN|MTL|NJD|NSH|NYI|NYR|OTT|PHI|PIT|SEA|SJS|STL|TBL|TOR|UTA|VAN|VGK|WPG|WSH)$")
OPPONENT = re.compile(r"^(@|vs\.)\s*(ANA|BOS|BUF|CAR|CBJ|CGY|CHI|COL|DAL|DET|EDM|FLA|LAK|MIN|MTL|NJD|NSH|NYI|NYR|OTT|PHI|PIT|SEA|SJS|STL|TBL|TOR|UTA|VAN|VGK|WPG|WSH)$")
STATUS = {"expected": "projected", "confirmed": "confirmed", "unknown": "unknown"}

class Visible(HTMLParser):
    def __init__(self):
        super().__init__()
        self.chunks = []
        self.hidden = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"):
            self.hidden += 1
        if tag in ("div", "td", "tr", "li", "br", "p", "h2", "h3"):
            self.chunks.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self.hidden = max(0, self.hidden - 1)
        if tag in ("div", "td", "tr", "li", "p", "h2", "h3"):
            self.chunks.append("\n")
    def handle_data(self, value):
        if not self.hidden:
            self.chunks.append(value)

def norm(value):
    return re.sub(r"[^a-z]", "", unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().lower())

def load(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html,application/json"})
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.read().decode("utf-8", "replace")

def extract(page, rosters):
    parser = Visible()
    parser.feed(page)
    lines = [re.sub(r"\s+", " ", html.unescape(x)).strip() for x in "".join(parser.chunks).splitlines()]
    lines = [x for x in lines if x]
    # Never parse the explanatory legend as game data.
    for i, line in enumerate(lines):
        if "Projected Goalie Status" in line:
            lines = lines[:i]
            break
    names = {}
    for team in rosters.values():
        abbr = team.get("abbrev")
        if abbr:
            names[abbr] = {norm(name): name for name in team.get("goalies", [])}
    candidates = []
    team = None
    for i, line in enumerate(lines):
        # Team headers may be repeated visually (ANAANA).
        header = re.fullmatch(r"([A-Z]{3})\1", line)
        abbr = header.group(1) if header else line
        if TEAMS.fullmatch(abbr):
            team = abbr
            continue
        if not team:
            continue
        goalie = names.get(team, {}).get(norm(line))
        if not goalie:
            continue
        next_lines = lines[i+1:i+5]
        opponent = next((OPPONENT.fullmatch(x) for x in next_lines if OPPONENT.fullmatch(x)), None)
        if not opponent:
            continue
        status = next((STATUS[x.lower()] for x in next_lines if x.lower() in STATUS), None)
        if not status:
            continue
        candidates.append({"team": team, "goalie": goalie, "opponent": opponent.group(2),
                           "venue": "away" if opponent.group(1) == "@" else "home",
                           "status": status})
    return candidates

def match_schedule(candidates, schedule):
    matches = []
    for candidate in candidates:
        possibilities = []
        for day in schedule.get("gameWeek", []):
            for game in day.get("games", []):
                home = game.get("homeTeam", {}).get("abbrev")
                away = game.get("awayTeam", {}).get("abbrev")
                if candidate["venue"] == "home" and home == candidate["team"] and away == candidate["opponent"]:
                    possibilities.append((day["date"], game.get("id"), game.get("startTimeUTC")))
                elif candidate["venue"] == "away" and away == candidate["team"] and home == candidate["opponent"]:
                    possibilities.append((day["date"], game.get("id"), game.get("startTimeUTC")))
        if len(possibilities) == 1:
            date, game_id, start = possibilities[0]
            matches.append({**candidate, "date": date, "gameId": game_id, "startTimeUTC": start, "source": URL})
    return matches

NEWS = "https://www.rotowire.com/hockey/news.php?pos=G"


def attach_reports(rows, schedule, observed):
    candidates = [row for row in rows if row["status"] == "confirmed"]
    if not candidates:
        return
    try:
        index = load(NEWS)
    except (URLError, TimeoutError) as exc:
        print("RotoWire news index unavailable:", type(exc).__name__)
        return
    paths = re.findall(r'href="(/hockey/headlines/[a-z0-9-]+-\d+)"', index)
    opponents = {}
    for day in schedule.get("gameWeek", []):
        for game in day.get("games", []):
            for side in ("awayTeam", "homeTeam"):
                team = game[side]
                names = [team.get(field, {}).get("default") for field in ("commonName", "placeName")]
                opponents[team["abbrev"]] = [name for name in names if name]
    for row in candidates:
        slug = "-".join(norm(word) for word in row["goalie"].split())
        prefix = "/hockey/headlines/" + slug + "-"
        for path in dict.fromkeys(p for p in paths if p.startswith(prefix)):
            url = "https://www.rotowire.com" + path
            try:
                page = load(url)
                blocks = re.findall(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', page, re.S | re.I)
                for block in blocks:
                    data = json.loads(block)
                    for article in data if isinstance(data, list) else [data]:
                        if not isinstance(article, dict) or article.get("@type") != "NewsArticle":
                            continue
                        evidence = match_report(article, row, opponents[row["opponent"]], observed)
                        if evidence:
                            row.update(evidence, source=url)
                            break
                    if "confirmationEvidence" in row:
                        break
            except (URLError, TimeoutError, ValueError) as exc:
                print("RotoWire report unavailable:", path, type(exc).__name__)
            if "confirmationEvidence" in row:
                break


def match_report(article, row, opponent, observed):
    if row.get("status") != "confirmed":
        return
    about = article.get("about")
    if not isinstance(about, dict) or about.get("name") != row["goalie"]:
        return
    try:
        published = datetime.datetime.fromisoformat(article["datePublished"])
    except (KeyError, TypeError, ValueError):
        return
    kickoff = datetime.datetime.fromisoformat(row["startTimeUTC"])
    if published.tzinfo is None or not published <= observed < kickoff:
        return
    # A changed article cannot prove that its current wording existed at publication.
    if article.get("dateModified") is not None:
        try:
            modified = datetime.datetime.fromisoformat(article["dateModified"])
        except (TypeError, ValueError):
            return
        if modified.tzinfo is None or modified != published:
            return
    day = datetime.date.fromisoformat(row["date"])
    published_day = published.astimezone(ZoneInfo("America/New_York")).date()
    if (day - published_day).days not in (0, 1):
        return
    # Accept a direct starter announcement for this venue, opponent and weekday.
    # Keep unfamiliar, conditional and retrospective wording unverified.
    text = article.get("description") or ""
    surname = re.escape(row["goalie"].split()[-1])
    if row.get("venue") not in ("home", "away"):
        return
    venue = "home" if row["venue"] == "home" else "road"
    weekday = day.strftime("%A")
    if not opponent:
        return
    rival = "(?:" + "|".join(re.escape(name) for name in opponent) + ")"
    matchup = rf"(?:against (?:the )?{rival} on {weekday}|in {weekday}'s clash against (?:the )?{rival})"
    credit = r"(?:, (?:[\w’\x27 -]+ of NHL\.com reports|(?:according to|per) [^.!?]+(?:\.com)?))?"
    crease_report = rf"(?:defend the {venue} net|patrol the {venue} crease|guard the {venue} net|patrol the {venue} net) {matchup}{credit}"
    # A reporter credit may follow the complete, schedule-bound start announcement.
    start_report = rf"start {weekday}'s {venue} game against (?:the )?{rival}(?:, [\w’' -]+ of [\w’' -]+ reports)?"
    if not isinstance(text, str) or not re.fullmatch(
            rf"{surname} will (?:{crease_report}|{start_report})[.]", text, re.I):
        return
    return {"confirmationBasis": "explicit_pregame_report", "confirmationEvidence": text,
            "sourcePublishedAt": published.astimezone(datetime.timezone.utc).isoformat().replace("+00:00", "Z")}


def main():
    with (ROOT / "nhl_rosters.json").open(encoding="utf-8") as handle:
        rosters = json.load(handle)["teams"]
    now = datetime.datetime.now(datetime.timezone.utc)
    schedule = json.loads(load("https://api-web.nhle.com/v1/schedule/" + now.date().isoformat()))
    candidates = extract(load(URL), rosters)
    schedule_matches = match_schedule(candidates, schedule)
    games = [
        {"gameId": game.get("id"), "date": day.get("date"),
         "home": game.get("homeTeam", {}).get("abbrev"),
         "away": game.get("awayTeam", {}).get("abbrev")}
        for day in schedule.get("gameWeek", [])
        for game in day.get("games", [])
    ]
    matches, identity_issues = validate_game_claims(schedule_matches, games)
    attach_reports(matches, schedule, now)
    dates = {str(game["gameId"]): game["date"] for game in games}
    for issue in identity_issues:
        issue["date"] = dates.get(str(issue.get("gameId")))
    result = {"checkedAt": now.isoformat(), "source": URL,
              "candidateCount": len(candidates), "matchedCount": len(matches),
              "gameIdentityIssues": identity_issues,
              "matches": matches, "unmatched": [c for c in candidates if not any(
                  m["team"] == c["team"] and m["goalie"] == c["goalie"] and
                  m["opponent"] == c["opponent"] and m["venue"] == c["venue"]
                  for m in matches)]}
    with (ROOT / "rotowire_goalies_diagnostic.json").open("w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    print("RotoWire candidates:", len(candidates), "schedule-verified:", len(matches))

if __name__ == "__main__":
    main()
