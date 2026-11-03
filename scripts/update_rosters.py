import json,datetime,urllib.request,time
teams={"ANA":"ducks","BOS":"bruins","BUF":"sabres","CAR":"hurricanes","CBJ":"blue jackets","CGY":"flames","CHI":"blackhawks","COL":"avalanche","DAL":"stars","DET":"red wings","EDM":"oilers","FLA":"panthers","LAK":"kings","MIN":"wild","MTL":"canadiens","NJD":"devils","NSH":"predators","NYI":"islanders","NYR":"rangers","OTT":"senators","PHI":"flyers","PIT":"penguins","SEA":"kraken","SJS":"sharks","STL":"blues","TBL":"lightning","TOR":"maple leafs","UTA":"mammoth","VAN":"canucks","VGK":"golden knights","WPG":"jets","WSH":"capitals"}
def player_name(p):
 def value(x):
  if isinstance(x,dict):return x.get("default") or next(iter(x.values()),"")
  return x or ""
 return (str(value(p.get("firstName")))+" "+str(value(p.get("lastName")))).strip()
try:
 with open("nhl_rosters.json",encoding="utf-8") as f:out=json.load(f)
except (OSError,ValueError):out={"teams":{}}
out.setdefault("teams",{})
ok=0
for abbr,key in teams.items():
 try:
  req=urllib.request.Request("https://api-web.nhle.com/v1/roster/"+abbr+"/current",headers={"User-Agent":"BangerNHL/1.0","Accept":"application/json"})
  with urllib.request.urlopen(req,timeout=12) as r:raw=json.load(r)
  record={"forwards":[player_name(p) for p in raw.get("forwards",[])],"defense":[player_name(p) for p in raw.get("defensemen",[])],"goalies":[player_name(p) for p in raw.get("goalies",[])],"playerIds":{player_name(p):p["id"] for p in raw.get("forwards",[])+raw.get("defensemen",[])+raw.get("goalies",[]) if player_name(p) and isinstance(p.get("id"),int)},"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"abbrev":abbr}
  if len(record["forwards"])>=8 and len(record["defense"])>=4:
   out["teams"][key]=record;ok+=1
 except Exception as e:print("Roster unavailable",abbr,str(e))
out["fetchedAt"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
if not out["teams"]:raise SystemExit("No roster data available")
with open("nhl_rosters.json","w",encoding="utf-8") as f:json.dump(out,f,ensure_ascii=False,indent=2)
print("Roster teams refreshed",ok,"available",len(out["teams"]))
