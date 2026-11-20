"""DATA-14: offline multi-source readiness and recovery prioritization.

Reads existing reports only. Never downloads or republishes third-party lineups.
"""
import json
from pathlib import Path
try:
    from scripts.data_14_multisource_gate import source_readiness
except ModuleNotFoundError:
    from data_14_multisource_gate import source_readiness

ROOT = Path(__file__).resolve().parent.parent


def build_report(usage, recovery, coverage):
    sources = source_readiness(usage)
    # Do not treat HTTP 200 as permission or evidence of a usable lineup.
    for name, entry in sources.items():
        entry["status"] = (
            "active_existing_source_permission_unverified" if name == "nhl.com" and entry["usedTeams"] > 0
            else "blocked_pending_reuse_permission" if not entry["automaticReuseAuthorized"]
            else "available_not_active"
        )
    stale = {name for name, item in coverage.get("teams", {}).items()
             if item.get("hasProjectedLines") and item.get("currentProjection") is not True}
    recovery_teams = recovery.get("teams", [])
    priorities = []
    for item in recovery_teams:
        team = item.get("team")
        if not team:
            continue
        priorities.append({
            "team": team,
            "stale": team in stale,
            "missingForwardLines": item.get("missingForwardLines"),
            "missingDefensePairs": item.get("missingDefensePairs"),
            "reason": item.get("reason"),
            "action": item.get("nextAction"),
            "requiresIndependentEvidence": bool(item.get("rejectedLines")),
        })
    priorities.sort(key=lambda x: (
        not x["stale"],
        not x["requiresIndependentEvidence"],
        x["team"]))
    return {
        "sourceReadiness": sources,
        "incompleteTeams": len(priorities),
        "staleTeams": len(stale),
        "prioritizedRecovery": priorities,
        "thirdPartyContentImported": False,
        "note": "Diagnostic only; no automatic third-party lineup ingestion or publication.",
    }


def main():
    def load(filename):
        path = ROOT / filename
        return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    result = build_report(
        load("lineup_source_usage_report.json"),
        load("lineup_recovery_plan.json"),
        load("lineups_coverage.json"))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
