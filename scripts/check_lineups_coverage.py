import json,datetime
with open("nhl_rosters.json",encoding="utf-8") as f:rosters=json.load(f).get("teams",{})
with open("lineups.json",encoding="utf-8") as f:live=json.load(f).get("teams",{})
with open("lineups_archive.json",encoding="utf-8") as f:archive=json.load(f).get("teams",{})
with open("lineups_verified_snapshot.json",encoding="utf-8") as f:snapshots=json.load(f).get("teams",{})
teams={}
for name in sorted(rosters):
 sources=[label for label,entries in (("automatic",live),("archive",archive),("manual",snapshots)) if name in entries]
 teams[name]={"hasProjectedLines":bool(sources),"sources":sources}
out={"generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"totalTeams":len(teams),"withProjectedLines":sum(t["hasProjectedLines"] for t in teams.values()),"missing":[name for name,t in teams.items() if not t["hasProjectedLines"]],"teams":teams}
with open("lineups_coverage.json","w",encoding="utf-8") as f:json.dump(out,f,ensure_ascii=False,indent=2)
print("COVERAGE",out["withProjectedLines"],"/",out["totalTeams"],"MISSING:",", ".join(out["missing"]))
