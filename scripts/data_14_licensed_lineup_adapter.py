"""DATA-14.6: offline adapter for licensed lineup metadata.

No network requests, credentials, file writes or production integration.
Only a caller-supplied permission policy can enable a candidate.
"""
from datetime import datetime, timezone
from urllib.parse import urlparse
try:
    from scripts.data_14_multisource_gate import assess_candidate
except ModuleNotFoundError:
    from data_14_multisource_gate import assess_candidate


def adapt_lineup(payload, policy, *, now=None, max_age_hours=36):
    if not isinstance(payload, dict) or not isinstance(policy, dict):
        return {"accepted": False, "reason": "invalid_input"}
    provider = payload.get("provider")
    rules = policy.get(provider)
    if not isinstance(rules, dict) or not rules.get("automaticReuseAuthorized"):
        return {"accepted": False, "reason": "reuse_not_authorized"}
    allowed_hosts = rules.get("allowedHosts", [])
    if not allowed_hosts or not isinstance(allowed_hosts, list):
        return {"accepted": False, "reason": "provider_hosts_not_configured"}
    url = payload.get("sourceUrl", "")
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
    except (ValueError, TypeError):
        return {"accepted": False, "reason": "invalid_source_url"}
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port not in (None, 443) or host not in allowed_hosts:
        return {"accepted": False, "reason": "provider_url_not_allowed"}
    try:
        published = datetime.fromisoformat(payload["publishedAt"].replace("Z", "+00:00"))
        if published.tzinfo is None:
            raise ValueError("naive timestamp")
        current = now or datetime.now(timezone.utc)
        age = (current - published).total_seconds()
        if age < 0 or age > max_age_hours * 3600:
            return {"accepted": False, "reason": "stale_or_future_projection"}
    except (KeyError, TypeError, ValueError, AttributeError):
        return {"accepted": False, "reason": "invalid_published_at"}
    team = payload.get("team")
    game_id = payload.get("gameId")
    if not isinstance(team, str) or not team.strip() or not isinstance(game_id, (str, int)) or not str(game_id).isdigit():
        return {"accepted": False, "reason": "missing_game_identity"}
    forwards = payload.get("forwards")
    defense = payload.get("defense")
    if not isinstance(forwards, list) or not isinstance(defense, list) or len(forwards) != 4 or len(defense) != 3:
        return {"accepted": False, "reason": "incomplete_formation"}
    if any(not isinstance(line, list) or len(line) != expected or
           any(not isinstance(player, str) or not player.strip() for player in line)
           for lines, expected in ((forwards, 3), (defense, 2)) for line in lines):
        return {"accepted": False, "reason": "invalid_player_group"}
    names = [player.strip().casefold() for line in forwards + defense for player in line]
    if len(names) != len(set(names)):
        return {"accepted": False, "reason": "duplicate_player"}
    candidate = {"provider": provider, "sourceUrl": url,
                 "publishedAt": payload["publishedAt"],
                 "rosterValidated": payload.get("rosterValidated") is True,
                 "forwardLines": len(forwards), "defensePairs": len(defense),
                 "gameConfirmed": payload.get("gameConfirmed") is True}
    result = assess_candidate(candidate, policy)
    if not result["accepted"]:
        return result
    return {"accepted": True, "reason": "licensed_validated_projection",
            "team": team.strip(), "gameId": str(game_id),
            "provider": provider, "sourceUrl": url,
            "publishedAt": payload["publishedAt"],
            "confirmedNextGame": False,
            "forwards": forwards, "defense": defense}
