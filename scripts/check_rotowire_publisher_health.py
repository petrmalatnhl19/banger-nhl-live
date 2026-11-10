"""Report RotoWire publisher freshness without rewriting historical observations."""
import datetime as dt
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def inspect(feed, now=None, max_age_minutes=120):
    now = now or dt.datetime.now(dt.timezone.utc)
    try:
        updated = dt.datetime.fromisoformat(feed["updatedAt"].replace("Z", "+00:00"))
        if updated.tzinfo is None:
            raise ValueError("naive timestamp")
    except (KeyError, AttributeError, ValueError, TypeError):
        return {"status": "invalid_timestamp", "ageMinutes": None}
    age = round((now - updated).total_seconds() / 60)
    return {"status": "future_timestamp" if age < 0 else "stale" if age > max_age_minutes else "fresh",
            "ageMinutes": age, "updatedAt": feed["updatedAt"],
            "gameCount": len(feed.get("games", []))}

def main():
    try:
        feed = json.loads((ROOT / "rotowire_goalies.json").read_text(encoding="utf-8"))
        result = inspect(feed)
    except (OSError, ValueError) as exc:
        result = {"status": "unavailable", "error": str(exc)}
    result["publisherSucceededThisRun"] = os.getenv("CORE43_ROTOWIRE_PUBLISH_OK") == "true"
    result["parserSucceededThisRun"] = os.getenv("CORE43_ROTOWIRE_PARSE_OK") == "true"
    summary = os.getenv("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("### RotoWire goalie publisher health\n\n")
            f.write("| Field | Value |\n|---|---|\n")
            for k, v in result.items():
                f.write(f"| {k} | {v} |\n")
            f.write("\n")
    if result["status"] != "fresh" or not result["publisherSucceededThisRun"]:
        print("::warning title=RotoWire goalie feed health::" + json.dumps(result))
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
