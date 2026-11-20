"""DATA-13: offline validation of goalie claims against a specific NHL game."""
from collections import defaultdict


def validate_game_claims(records, games):
    """Return accepted claims and diagnostics; fail closed on ambiguous games."""
    indexed = {}
    for game in games:
        game_id = str(game.get("gameId", ""))
        date = game.get("date")
        home = game.get("home")
        away = game.get("away")
        if game_id and date and home and away and home != away:
            indexed[game_id] = (date, home, away)
    grouped = defaultdict(list)
    issues = []
    for claim in records:
        game_id = str(claim.get("gameId", ""))
        identity = indexed.get(game_id)
        team = claim.get("team")
        opponent = claim.get("opponent")
        venue = claim.get("venue")
        if not identity:
            issues.append({"gameId": game_id, "reason": "unknown_game"})
            continue
        date, home, away = identity
        expected = (home, away) if venue == "home" else (away, home) if venue == "away" else (None, None)
        if claim.get("date") != date or (team, opponent) != expected:
            issues.append({"gameId": game_id, "team": team, "reason": "game_identity_mismatch"})
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
