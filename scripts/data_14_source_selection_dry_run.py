"""DATA-14.7: offline dry-run source selection diagnostics.

Never fetches, publishes, or mutates lineup data. The existing NHL collector
remains untouched. A licensed adapter candidate is only an evaluation result.
"""
try:
    from scripts.data_14_licensed_lineup_adapter import adapt_lineup
except ModuleNotFoundError:
    from data_14_licensed_lineup_adapter import adapt_lineup


def dry_run_selection(existing, candidates, policy, *, now=None):
    """Compare existing team records with hypothetical licensed candidates."""
    results = []
    for candidate in candidates:
        team = candidate.get("team") if isinstance(candidate, dict) else None
        evaluation = adapt_lineup(candidate, policy, now=now)
        old = existing.get(team, {}) if isinstance(team, str) else {}
        selected = "existing" if old else "none"
        recommendation = "no_change"
        if evaluation.get("accepted"):
            recommendation = "manual_review_required"
        results.append({
            "team": team, "candidateProvider": candidate.get("provider") if isinstance(candidate, dict) else None,
            "candidateAccepted": evaluation.get("accepted", False),
            "candidateReason": evaluation.get("reason"),
            "existingSource": old.get("source"),
            "existingPublishedAt": old.get("publishedAt"),
            "selectedSource": selected,
            "recommendation": recommendation,
            "autoSwitched": False,
        })
    return {"mode": "offline_dry_run", "evaluated": len(results),
            "automaticallySwitched": 0, "results": results}
