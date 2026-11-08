#!/usr/bin/env python3
"""Summarize exactly why projected NHL lines were rejected by roster checks."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
src = root / "lineups_source_diagnostics.json"
if not src.exists():
    print("No source diagnostics available")
    raise SystemExit(0)
data = json.loads(src.read_text(encoding="utf-8"))
issues = {}
for slug, entry in sorted(data.get("teams", {}).items()):
    rejected = entry.get("rejectedLines", [])
    if not rejected:
        continue
    reasons = {(p.get("name"), p.get("expectedRole")): p.get("reason") for p in entry.get("rejectedPlayerReasons", [])}
    issues[slug] = {
        "team": entry.get("team"),
        "candidateForwardLines": entry.get("candidateForwardLines"),
        "candidateDefensePairs": entry.get("candidateDefensePairs"),
        "validatedForwardLines": entry.get("validatedForwardLines"),
        "validatedDefensePairs": entry.get("validatedDefensePairs"),
        "rejected": [
            {"group": line.get("group"), "sourceLineNumber": line.get("line"),
             "sourceLine": line.get("sourceLine"),
             "unverifiedPlayers": [{"name": p, "reason": reasons.get((p, line.get("group")), "unknown")}
                                   for p in line.get("players", [])]}
            for line in rejected
        ],
    }
out = {"teamsWithRejectedLines": len(issues), "teams": issues,
       "note": "Unverified players must not be automatically inserted into a projected lineup."}
(root / "lineup_rejections_report.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Teams with rejected lines: {len(issues)}")
for slug, team in issues.items():
    print(f"{slug}: source {team['candidateForwardLines']}F/{team['candidateDefensePairs']}D -> verified {team['validatedForwardLines']}F/{team['validatedDefensePairs']}D")
