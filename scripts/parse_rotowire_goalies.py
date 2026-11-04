"""Read RotoWire team-view goalie projections into a diagnostic JSON file.

No production predictions are modified. Match each record against official
NHL roster names and NHL schedule before accepting it.
"""
import datetime
import html
import json
import re
import urllib.request
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

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
                    possibilities.append((day["date"], game.get("id")))
                elif candidate["venue"] == "away" and away == candidate["team"] and home == candidate["opponent"]:
                    possibilities.append((day["date"], game.get("id")))
        if len(possibilities) == 1:
            date, game_id = possibilities[0]
            matches.append({**candidate, "date": date, "gameId": game_id, "source": URL})
    return matches

def main():
    with (ROOT / "nhl_rosters.json").open(encoding="utf-8") as handle:
        rosters = json.load(handle)["teams"]
    now = datetime.datetime.now(datetime.timezone.utc)
    schedule = json.loads(load("https://api-web.nhle.com/v1/schedule/" + now.date().isoformat()))
    candidates = extract(load(URL), rosters)
    matches = match_schedule(candidates, schedule)
    result = {"checkedAt": now.isoformat(), "source": URL,
              "candidateCount": len(candidates), "matchedCount": len(matches),
              "matches": matches, "unmatched": [c for c in candidates if not any(
                  m["team"] == c["team"] and m["goalie"] == c["goalie"] and
                  m["opponent"] == c["opponent"] and m["venue"] == c["venue"]
                  for m in matches)]}
    with (ROOT / "rotowire_goalies_diagnostic.json").open("w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    print("RotoWire candidates:", len(candidates), "schedule-verified:", len(matches))

if __name__ == "__main__":
    main()
