"""DATA-11: offline audit of published goalie feed; never infer a starter."""
import datetime
import json
from pathlib import Path

def audit(feed, now=None):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    result = {"status": feed.get("status", "unknown"), "publishedTeams": 0,
              "usableTeams": 0, "rejectedTeams": [], "sourceErrors": len(feed.get("sourceErrors", [])),
              "conflicts": len(feed.get("conflicts", [])), "issues": []}
    teams = feed.get("teams", {})
    if not isinstance(teams, dict):
        result["issues"].append("invalid_teams_schema")
        teams = {}
    result["publishedTeams"] = len(teams)
    try:
        updated = datetime.datetime.fromisoformat(feed["updatedAt"].replace("Z", "+00:00"))
        if updated.tzinfo is None:
            raise ValueError("naive timestamp")
        age = (now - updated).total_seconds()
        if not 0 <= age <= 24 * 3600:
            result["issues"].append("stale_or_future_export")
    except (KeyError, AttributeError, TypeError, ValueError):
        result["issues"].append("invalid_export_timestamp")
    try:
        export_day = datetime.date.fromisoformat(feed["date"])
        if export_day != now.date():
            result["issues"].append("export_not_utc_today")
    except (KeyError, TypeError, ValueError):
        result["issues"].append("invalid_export_date")
        export_day = None
    for team, entry in teams.items():
        reasons = []
        if not isinstance(entry, dict):
            reasons.append("invalid_entry")
        else:
            if entry.get("status") not in ("projected", "confirmed"):
                reasons.append("invalid_status")
            if not isinstance(entry.get("name"), str) or not entry["name"].strip():
                reasons.append("missing_name")
            if not isinstance(entry.get("source"), str) or not entry["source"].startswith("https://"):
                reasons.append("missing_source")
            if entry.get("date") != feed.get("date"):
                reasons.append("wrong_game_date")
            if entry.get("status") == "confirmed" and not entry.get("confirmationEvidence"):
                reasons.append("unsubstantiated_confirmation")
        if reasons:
            result["rejectedTeams"].append({"team": team, "reasons": reasons})
        elif not result["issues"]:
            result["usableTeams"] += 1
    if not teams:
        result["issues"].append("no_starter_projections")
    if feed.get("sourceErrors"):
        result["issues"].append("source_failures")
    if feed.get("conflicts"):
        result["issues"].append("source_conflicts")
    if feed.get("status") == "complete" and (result["issues"] or result["rejectedTeams"]):
        result["issues"].append("false_complete_status")
    return result

if __name__ == "__main__":
    report = audit(json.loads(Path("starting_goalies.json").read_text(encoding="utf-8")))
    print(json.dumps(report, ensure_ascii=False, indent=2))
