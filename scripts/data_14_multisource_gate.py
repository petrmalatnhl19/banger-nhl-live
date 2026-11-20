"""DATA-14: safe multi-source lineup evidence gate.

This module only evaluates explicitly supplied metadata. It does not fetch,
parse, copy or republish third-party lineups.
"""
from urllib.parse import urlparse

SOURCE_POLICY = {
    "nhl.com": {"role": "primary", "automaticReuseAuthorized": True},
    "fantasy_roundup": {"role": "fallback", "automaticReuseAuthorized": False},
    "between_the_lines": {"role": "diagnostic", "automaticReuseAuthorized": False},
}


def assess_candidate(candidate, policy=None):
    """Return a conservative decision, never a confirmed next-game lineup."""
    policy = policy or SOURCE_POLICY
    source = candidate.get("provider")
    rules = policy.get(source)
    if not rules:
        return {"accepted": False, "reason": "unknown_provider"}
    if not rules.get("automaticReuseAuthorized", False):
        return {"accepted": False, "reason": "reuse_not_authorized"}
    if not candidate.get("sourceUrl") or not candidate.get("publishedAt"):
        return {"accepted": False, "reason": "missing_provenance"}
    url = urlparse(candidate["sourceUrl"])
    if url.scheme != "https" or not url.hostname:
        return {"accepted": False, "reason": "invalid_source_url"}
    if source == "nhl.com" and not (url.hostname == "nhl.com" or url.hostname.endswith(".nhl.com")):
        return {"accepted": False, "reason": "provider_url_mismatch"}
    if not candidate.get("rosterValidated"):
        return {"accepted": False, "reason": "roster_not_validated"}
    if candidate.get("forwardLines", 0) < 4 or candidate.get("defensePairs", 0) < 3:
        return {"accepted": False, "reason": "incomplete_formation"}
    if candidate.get("gameConfirmed"):
        return {"accepted": False, "reason": "unsupported_game_confirmation"}
    return {"accepted": True, "reason": "validated_projection_only", "confirmedNextGame": False}


def source_readiness(usage_report):
    sources = usage_report.get("sources", {})
    return {
        name: {
            "role": source.get("role"),
            "usedTeams": source.get("usedTeams", 0),
            "reachable": source.get("reachable"),
            "automaticReuseAuthorized": source.get("automaticReuseAuthorized", name == "nhl.com"),
            "canAutoPublish": name == "nhl.com",
        }
        for name, source in sorted(sources.items())
    }
