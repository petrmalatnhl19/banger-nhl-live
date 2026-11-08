#!/usr/bin/env python3
"""BANGER Lineup Core 2.0: read-only source-aware completeness report.
Only evaluates existing licensed/approved local data; never fills missing lines.
"""
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "lineups.json"
OUTPUT = ROOT / "lineup_core_report.json"
data = json.loads(SOURCE.read_text(encoding="utf-8"))
teams = data.get("teams", {})
report = {"generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "sourceFile": "lineups.json", "teams": {}, "summary": {}}
EXPECTED = {
    "ANA": "ducks",
    "BOS": "bruins",
    "BUF": "sabres",
    "CAR": "hurricanes",
    "CBJ": "blue jackets",
    "CGY": "flames",
    "CHI": "blackhawks",
    "COL": "avalanche",
    "DAL": "stars",
    "DET": "red wings",
    "EDM": "oilers",
    "FLA": "panthers",
    "LAK": "kings",
    "MIN": "wild",
    "MTL": "canadiens",
    "NJD": "devils",
    "NSH": "predators",
    "NYI": "islanders",
    "NYR": "rangers",
    "OTT": "senators",
    "PHI": "flyers",
    "PIT": "penguins",
    "SEA": "kraken",
    "SJS": "sharks",
    "STL": "blues",
    "TBL": "lightning",
    "TOR": "maple leafs",
    "UTA": "mammoth",
    "VAN": "canucks",
    "VGK": "golden knights",
    "WPG": "jets",
    "WSH": "capitals",
}
counts = {"complete": 0, "incomplete": 0, "missing": 0}
for slug, team in sorted(teams.items()):
    forwards = team.get("forwards") or []
    defense = team.get("defense") or []
    f_valid = [isinstance(row, list) and len(row) == 3 and all(isinstance(p, str) and p.strip() for p in row) for row in forwards]
    d_valid = [isinstance(row, list) and len(row) == 2 and all(isinstance(p, str) and p.strip() for p in row) for row in defense]
    players = [p.casefold().strip() for rows in (forwards, defense) for row in rows if isinstance(row, list) for p in row if isinstance(p, str)]
    duplicate = sorted({p for p in players if players.count(p) > 1})
    complete = len(forwards) == 4 and all(f_valid) and len(defense) == 3 and all(d_valid) and not duplicate
    counts["complete" if complete else "incomplete"] += 1
    report["teams"][slug] = {
        "name": team.get("name", slug), "complete": complete,
        "forwardLines": len(forwards), "defensePairs": len(defense),
        "missingForwardLines": max(0, 4 - len(forwards)),
        "missingDefensePairs": max(0, 3 - len(defense)),
        "malformedForwardLines": [i + 1 for i, ok in enumerate(f_valid) if not ok],
        "malformedDefensePairs": [i + 1 for i, ok in enumerate(d_valid) if not ok],
        "duplicatePlayers": duplicate, "source": team.get("source"),
        "publishedAt": team.get("publishedAt"),
        "status": "complete_projection" if complete else "incomplete_projection",
    }
for abbreviation, slug in EXPECTED.items():
    if slug not in teams:
        counts["missing"] += 1
        report["teams"][slug] = {
            "name": slug.title(), "abbreviation": abbreviation,
            "complete": False, "forwardLines": 0, "defensePairs": 0,
            "missingForwardLines": 4, "missingDefensePairs": 3,
            "status": "missing_team", "source": None, "publishedAt": None,
        }
report["summary"] = {"teams": len(teams), "expectedTeams": len(EXPECTED), **counts,
                     "coveragePercent": round(100 * len(teams) / len(EXPECTED), 1)}
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("BANGER Lineup Core 2.0:", json.dumps(report["summary"], ensure_ascii=False))
for slug, entry in report["teams"].items():
    if not entry["complete"]:
        print(f"{slug}: {entry['forwardLines']}/4 attacks, {entry['defensePairs']}/3 defense pairs")
