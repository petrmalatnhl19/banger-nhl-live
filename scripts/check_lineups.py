#!/usr/bin/env python3
"""Read-only completeness audit for lineups.json; never invent missing players."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / "lineups.json").read_text(encoding="utf-8"))
teams = data.get("teams", {})
issues = []
for slug, team in sorted(teams.items()):
    forwards = team.get("forwards") or []
    defense = team.get("defense") or []
    problems = []
    if len(forwards) != 4:
        problems.append(f"útoky {len(forwards)}/4")
    if len(defense) != 3:
        problems.append(f"obrany {len(defense)}/3")
    for label, units, expected in (("útok", forwards, 3), ("obrana", defense, 2)):
        for number, players in enumerate(units, 1):
            if not isinstance(players, list) or len(players) != expected or any(not isinstance(p, str) or not p.strip() for p in players):
                problems.append(f"neúplný {label} {number}")
    if problems:
        issues.append((slug, problems))
print(f"Kontrola sestav: {len(teams)} týmů, {len(issues)} neúplných.")
for slug, problems in issues:
    print(f" - {slug}: {', '.join(problems)}")
if issues:
    raise SystemExit(1)
