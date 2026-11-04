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
# Human-readable diagnostic for the eight teams previously shown as archive-only.
focus={"bruins":"BOS","hurricanes":"CAR","kings":"LAK","islanders":"NYI","rangers":"NYR","senators":"OTT","sharks":"SJS","jets":"WPG"}
report=["# NHL projection diagnostics","",f"Generated (UTC): {now.isoformat()}","",f"Fresh: {out['currentProjections']}/{out['totalTeams']}",""]
source_diag=read("lineups_source_diagnostics.json")
for key,abbr in focus.items():
 entry=teams.get(key,{})
 record=live.get(key,{})
 if entry.get("currentProjection"):
  status="FRESH"
 elif key not in live:
  status="NO VALIDATED LIVE PROJECTION"
 elif not record.get("publishedAt"):
  status="SOURCE PUBLICATION DATE MISSING"
 else:
  status="SOURCE PUBLICATION OLDER THAN 36 HOURS OR FUTURE-DATED"
 detail=source_diag.get(key,{})
 reason=detail.get("rosterValidation","unknown")
 report.append(f"- {abbr}: {status}; reason={reason}; candidate={detail.get('candidateFound','unknown')}; verified lines={detail.get('validatedForwardLines','?')}F/{detail.get('validatedDefensePairs','?')}D; publishedAt={record.get('publishedAt') or 'unknown'}; source={record.get('source') or 'unknown'}; archive={'yes' if key in archive else 'no'}")
Path("lineups_diagnostics.md").write_text("\n".join(report)+"\n",encoding="utf-8")
print("\n".join(report))
