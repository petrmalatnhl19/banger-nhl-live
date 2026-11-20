"""DATA-14: offline audit of projected lineup coverage and freshness.

Never infer confirmed next-game lineups from a recent article.
"""
import datetime
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def audit(coverage, source_diagnostics):
    teams = coverage.get("teams", {})
    sources = source_diagnostics.get("teams", {})
    report = []
    for team, item in sorted(teams.items()):
        source = sources.get(team, {})
        forward_count = source.get("validatedForwardLines")
        defense_count = source.get("validatedDefensePairs")
        fresh = item.get("currentProjection") is True
        has_lines = item.get("hasProjectedLines") is True
        if not has_lines:
            reason = "missing_projection"
        elif not fresh:
            reason = "needs_fresh_projection"
        elif isinstance(forward_count, int) and forward_count < 4:
            reason = "incomplete_forward_lines"
        elif isinstance(defense_count, int) and defense_count < 3:
            reason = "incomplete_defense_pairs"
        elif forward_count is None or defense_count is None:
            reason = "missing_validation_diagnostics"
        else:
            reason = "recent_projection_not_game_confirmation"
        report.append({
            "team": team, "reason": reason, "currentProjection": fresh,
            "validatedForwardLines": forward_count,
            "validatedDefensePairs": defense_count,
            "source": item.get("source"),
            "publishedAt": item.get("publishedAt"),
            "confirmedNextGame": False,
        })
    return {"teamCount": len(report), "teams": report,
            "needsFreshProjection": sum(x["reason"] == "needs_fresh_projection" for x in report),
            "missingProjection": sum(x["reason"] == "missing_projection" for x in report),
            "incompleteForwards": sum(x["reason"] == "incomplete_forward_lines" for x in report),
            "incompleteDefense": sum(x["reason"] == "incomplete_defense_pairs" for x in report)}


def main():
    coverage = json.loads((ROOT / "lineups_coverage.json").read_text(encoding="utf-8"))
    diagnostics = json.loads((ROOT / "lineups_source_diagnostics.json").read_text(encoding="utf-8"))
    result = audit(coverage, diagnostics)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
