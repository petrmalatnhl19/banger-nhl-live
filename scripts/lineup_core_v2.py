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
try:
    source_diagnostics = json.loads((ROOT / "lineups_source_diagnostics.json").read_text(encoding="utf-8")).get("teams", {})
except (OSError, ValueError):
    source_diagnostics = {}
alternative_count = 0
freshness_counts = {"recent_24h": 0, "aging_24_72h": 0, "historical_over_72h": 0, "undated": 0}
now = datetime.datetime.now(datetime.timezone.utc)
def source_freshness(value):
    if not value:
        return "undated", None
    try:
        published = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if published.tzinfo is None:
            return "undated", None
        age = max(0, (now - published).total_seconds() / 3600)
        return ("recent_24h" if age <= 24 else "aging_24_72h" if age <= 72 else "historical_over_72h"), round(age, 1)
    except (ValueError, TypeError, AttributeError):
        return "undated", None
for slug, team in sorted(teams.items()):
    forwards = team.get("forwards") or []
    defense = team.get("defense") or []
    f_valid = [isinstance(row, list) and len(row) == 3 and all(isinstance(p, str) and p.strip() for p in row) for row in forwards]
    d_valid = [isinstance(row, list) and len(row) == 2 and all(isinstance(p, str) and p.strip() for p in row) for row in defense]
    players = [p.casefold().strip() for rows in (forwards, defense) for row in rows if isinstance(row, list) for p in row if isinstance(p, str)]
    duplicate = sorted({p for p in players if players.count(p) > 1})
    complete = len(forwards) == 4 and all(f_valid) and len(defense) == 3 and all(d_valid) and not duplicate
    freshness, age_hours = source_freshness(team.get("publishedAt"))
    freshness_counts[freshness] += 1
    source_config = source_diagnostics.get(slug, {}).get("rosterConfiguration", {})
    alternative = (slug == "lightning" and not complete
                   and source_config.get("formation") == "11F+7D"
                   and source_config.get("verified") == "source_lists_11_forwards_and_7_defensemen"
                   and len(forwards) == 3 and all(f_valid)
                   and len(defense) == 3 and all(d_valid) and not duplicate)
    if alternative:
        alternative_count += 1
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
        "freshness": freshness, "sourceAgeHours": age_hours,
        "freshnessNote": "Publication age only; not confirmation of next-game lineup.",
        "status": "complete_projection" if complete else ("possible_11F_7D" if alternative else "incomplete_projection"),
        "alternativeFormation": source_config if alternative else None,
        "alternativeFormationVerified": False if alternative else None,
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
                     "coveragePercent": round(100 * len(teams) / len(EXPECTED), 1),
                     "possibleAlternativeFormations": alternative_count,
                     "freshness": freshness_counts}
report["refreshPriorities"] = [
    {"team": slug, "ageHours": entry.get("sourceAgeHours"),
     "publishedAt": entry.get("publishedAt"), "freshness": entry.get("freshness"),
     "status": entry.get("status"), "source": entry.get("source")}
    for slug, entry in sorted(
        report["teams"].items(),
        key=lambda item: (item[1].get("sourceAgeHours") is None,
                          -(item[1].get("sourceAgeHours") or 0))
    )
    if entry.get("freshness") in ("aging_24_72h", "historical_over_72h", "undated")
]
OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("BANGER Lineup Core 2.0:", json.dumps(report["summary"], ensure_ascii=False))
for slug, entry in report["teams"].items():
    if not entry["complete"]:
        print(f"{slug}: {entry['forwardLines']}/4 attacks, {entry['defensePairs']}/3 defense pairs")
