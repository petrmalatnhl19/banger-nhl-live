#!/usr/bin/env python3
"""Prioritize missing NHL projections using existing local diagnostics only."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
core = json.loads((root / "lineup_core_report.json").read_text(encoding="utf-8"))
rejections_path = root / "lineup_rejections_report.json"
rejections = json.loads(rejections_path.read_text(encoding="utf-8")) if rejections_path.exists() else {}
rejected_teams = rejections.get("teams", {})
items = []
for slug, team in sorted(core.get("teams", {}).items()):
    if team.get("complete"):
        continue
    rejected = rejected_teams.get(slug, {}).get("rejected", [])
    if team.get("status") == "missing_team":
        reason = "rejected_roster_lines" if rejected else "no_accepted_projection"
    elif rejected:
        reason = "rejected_roster_lines"
    else:
        reason = "incomplete_source_or_no_validated_replacement"
    items.append({
        "team": slug, "status": team.get("status"), "reason": reason,
        "missingForwardLines": team.get("missingForwardLines", 0),
        "missingDefensePairs": team.get("missingDefensePairs", 0),
        "source": team.get("source"), "publishedAt": team.get("publishedAt"),
        "rejectedLines": rejected,
        "nextAction": {
            "rejected_roster_lines": "Verify official roster and source-player identity; do not auto-approve.",
            "no_accepted_projection": "Find a current NHL.com projection and validate all players.",
            "incomplete_source_or_no_validated_replacement": "Look for newer complete NHL.com preview; do not infer missing lines.",
        }[reason],
    })
out = {
    "generatedFrom": ["lineup_core_report.json", "lineup_rejections_report.json"],
    "incompleteTeams": len(items), "teams": items,
    "policy": "Diagnostics only. Never synthesize or automatically publish unverified lines.",
}
(root / "lineup_recovery_plan.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Recovery priorities: {len(items)} teams")
for item in items:
    print(f"{item['team']}: {item['reason']}; missing {item['missingForwardLines']}F/{item['missingDefensePairs']}D")
