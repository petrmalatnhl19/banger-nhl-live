#!/usr/bin/env python3
"""Audit which lineup sources are actually used, without ingesting third-party content."""
import collections
import datetime
import json
from pathlib import Path
from urllib.parse import urlparse

def load(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}

lineups = load("lineups.json")
probe = load("lineup_free_sources_probe.json")
teams = lineups.get("teams", {})
counts = collections.Counter()
details = []
for team, record in sorted(teams.items()):
    source = record.get("source") or ""
    host = (urlparse(source).hostname or "").lower()
    provider = ("nhl.com" if host.endswith("nhl.com")
                else "fantasy_roundup" if host.endswith("fsroundup.com")
                else "other" if host else "unknown")
    counts[provider] += 1
    details.append({"team": team, "provider": provider,
                    "source": source, "publishedAt": record.get("publishedAt"),
                    "sourceType": record.get("sourceType")})
report = {
    "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "teams": len(details),
    "activeSourceCounts": dict(counts),
    "sources": {
        "nhl.com": {"role": "primary_projection_source", "usedTeams": counts["nhl.com"]},
        "fantasy_roundup": {
            "role": "fallback_only", "usedTeams": counts["fantasy_roundup"],
            "reachable": probe.get("sources", {}).get("fantasy_roundup", {}).get("reachable"),
            "automaticReuseAuthorized": probe.get("sources", {}).get("fantasy_roundup", {}).get("automaticReuseAuthorized", False)
        },
        "between_the_lines": {
            "role": "connectivity_probe_only", "usedTeams": 0,
            "reachable": probe.get("sources", {}).get("between_the_lines", {}).get("reachable"),
            "automaticReuseAuthorized": probe.get("sources", {}).get("between_the_lines", {}).get("automaticReuseAuthorized", False)
        }
    },
    "teamsDetail": details,
    "note": "HTTP availability does not establish freshness, correctness, or reuse rights. No third-party lineup data is collected by this audit."
}
Path("lineup_source_usage_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print("Lineup source usage:", dict(counts))
