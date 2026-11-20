"""DATA-12: summarize source connectivity separately from usable starter evidence."""
import json
from pathlib import Path

def summarize(starters, probe=None, diagnostic=None):
    teams = starters.get("teams") or {}
    if not isinstance(teams, dict):
        teams = {}
    sources = []
    for item in (probe or {}).get("results", []):
        sources.append({"source": item.get("source", "unknown"),
                        "reachable": item.get("ok") is True,
                        "usableStarterClaims": "not_assessed",
                        "error": item.get("error")})
    matched = (diagnostic or {}).get("matchedCount")
    return {
        "exportStatus": starters.get("status", "unknown"),
        "publishedTeams": len(teams),
        "publishedProjected": sum(isinstance(v,dict) and v.get("status")=="projected" for v in teams.values()),
        "publishedConfirmed": sum(isinstance(v,dict) and v.get("status")=="confirmed" for v in teams.values()),
        "sourceErrors": starters.get("sourceErrors", []),
        "conflicts": len(starters.get("conflicts", [])),
        "rotowireScheduleMatchedCandidates": matched if isinstance(matched,int) else "not_assessed",
        "sourceConnectivity": sources,
        "note": "HTTP reachability does not establish starter accuracy or reuse rights."
    }

def optional_json(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError,ValueError):
        return None

if __name__=="__main__":
    starters=optional_json("starting_goalies.json") or {}
    report=summarize(starters,optional_json("goalie_sources_probe.json"),optional_json("rotowire_goalies_diagnostic.json"))
    print(json.dumps(report,indent=2,ensure_ascii=False))
