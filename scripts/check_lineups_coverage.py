import json,datetime
from pathlib import Path
now=datetime.datetime.now(datetime.timezone.utc)
def read(path):
 try:
  return json.loads(Path(path).read_text(encoding="utf-8")).get("teams",{})
 except (OSError,ValueError):
  return {}
rosters=read("nhl_rosters.json")
live=read("lineups.json")
archive=read("lineups_archive.json")
snapshots=read("lineups_verified_snapshot.json")
def fresh(record):
 if not isinstance(record,dict):return False
 raw=record.get("publishedAt")
 if not raw:return False
 try:
  stamp=datetime.datetime.fromisoformat(raw.replace("Z","+00:00"))
  if stamp.tzinfo is None:return False
  return 0 <= (now-stamp).total_seconds() <= 36*3600
 except (ValueError,TypeError):return False
teams={}
for name in sorted(set(rosters)|set(live)|set(archive)|set(snapshots)):
 sources=[label for label,entries in (("automatic",live),("archive",archive),("manual",snapshots)) if name in entries]
 record=live.get(name,{})
 is_fresh=fresh(record)
 teams[name]={"hasProjectedLines":bool(sources),"sources":sources,
              "currentProjection":is_fresh,
              "publishedAt":record.get("publishedAt") if isinstance(record,dict) else None,
              "source":record.get("source") if isinstance(record,dict) else None,
              "needsFreshProjection":not is_fresh}
out={"generatedAt":now.isoformat(),"totalTeams":len(teams),
     "withProjectedLines":sum(t["hasProjectedLines"] for t in teams.values()),
     "currentProjections":sum(t["currentProjection"] for t in teams.values()),
     "needsFreshProjection":[name for name,t in teams.items() if t["needsFreshProjection"]],
     "missing":[name for name,t in teams.items() if not t["hasProjectedLines"]],"teams":teams}
Path("lineups_coverage.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
print("COVERAGE",out["withProjectedLines"],"/",out["totalTeams"])
print("CURRENT (published within 36h)",out["currentProjections"],"/",out["totalTeams"])
print("NEEDS FRESH PROJECTION:",", ".join(out["needsFreshProjection"]) or "none")
print("MISSING:",", ".join(out["missing"]) or "none")
