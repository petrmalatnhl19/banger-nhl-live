"""DATA-13: offline validation of goalie claims against a specific NHL game."""
from collections import defaultdict


def validate_game_claims(records, games):
    """Return accepted claims and diagnostics; fail closed on ambiguous games."""
    indexed = {}
    ambiguous_ids = set()
    for game in games:
        game_id = str(game.get("gameId", ""))
        date = game.get("date")
        home = game.get("home")
        away = game.get("away")
        if game_id and date and home and away and home != away:
            identity = (date, home, away)
            if game_id in indexed and indexed[game_id] != identity:
                ambiguous_ids.add(game_id)
            indexed[game_id] = identity
    for game_id in ambiguous_ids:
        indexed.pop(game_id, None)
    grouped = defaultdict(list)
    issues = []
    for claim in records:
        game_id = str(claim.get("gameId", ""))
        identity = indexed.get(game_id)
        team = claim.get("team")
        opponent = claim.get("opponent")
        venue = claim.get("venue")
        if not identity:
            issues.append({"gameId": game_id, "reason": "ambiguous_game" if game_id in ambiguous_ids else "unknown_game"})
            continue
        date, home, away = identity
        expected = (home, away) if venue == "home" else (away, home) if venue == "away" else (None, None)
        if claim.get("date") != date or (team, opponent) != expected:
            issues.append({"gameId": game_id, "team": team, "reason": "game_identity_mismatch"})
            continue
        if claim.get("status") not in ("projected", "confirmed"):
            issues.append({"gameId": game_id, "team": team, "reason": "invalid_status"})
            continue
        if not isinstance(claim.get("goalie"), str) or not claim["goalie"].strip():
            issues.append({"gameId": game_id, "team": team, "reason": "missing_goalie"})
            continue
        grouped[(game_id, team)].append(claim)
    accepted = []
    for (game_id, team), claims in grouped.items():
        names = {c.get("goalie") for c in claims}
        if len(names) != 1 or None in names:
            issues.append({"gameId": game_id, "team": team, "reason": "conflicting_goalies"})
            continue
        statuses = {c.get("status") for c in claims}
        if len(statuses) != 1:
            issues.append({"gameId": game_id, "team": team, "reason": "conflicting_status"})
            continue
        accepted.append(claims[0])
    return accepted, issues


def reconcile_source_claims(claims):
    """Conservatively reconcile claims for one team/game, without upgrading certainty.

    Only explicit pregame evidence qualifies a claim as confirmed. Disagreement
    between sources is reported, never silently resolved by source priority.
    """
    if not claims:
        return None, "no_claims"
    identities = {(str(c.get("gameId", "")), c.get("date"), c.get("team")) for c in claims}
    if len(identities) != 1 or any(not all(identity) for identity in identities):
        return None, "different_games"
    names = {c.get("goalie") for c in claims}
    if len(names) != 1 or not all(isinstance(name, str) and name.strip() for name in names):
        return None, "conflicting_goalies"
    statuses = {c.get("status") for c in claims}
    if not statuses.issubset({"projected", "confirmed"}):
        return None, "invalid_status"
    verified = [
        c for c in claims
        if c.get("status") == "confirmed"
        and c.get("confirmationBasis") == "explicit_pregame_report"
        and isinstance(c.get("confirmationEvidence"), str)
        and c["confirmationEvidence"].strip()
    ]
    # A confirmed label without evidence must never raise confidence.
    result = dict(claims[0])
    result["status"] = "confirmed" if verified else "projected"
    result.pop("confirmationBasis", None)
    result.pop("confirmationEvidence", None)
    if verified:
        result["confirmationBasis"] = verified[0]["confirmationBasis"]
        result["confirmationEvidence"] = verified[0]["confirmationEvidence"]
    return result, None
