#!/usr/bin/env python3
"""Experimental Daily Faceoff lineup importer. DRY RUN ONLY.

Writes dailyfaceoff_preview.json, never lineups.json. Run manually after
checking Daily Faceoff's applicable access/reuse terms. No automated polling.
"""
import argparse
import datetime as dt
import json
import re
import urllib.request
from html.parser import HTMLParser

TEAMS = {
 "ANA":"anaheim-ducks","BOS":"boston-bruins","BUF":"buffalo-sabres",
 "CAR":"carolina-hurricanes","CBJ":"columbus-blue-jackets",
 "CGY":"calgary-flames","CHI":"chicago-blackhawks","COL":"colorado-avalanche",
 "DAL":"dallas-stars","DET":"detroit-red-wings","EDM":"edmonton-oilers",
 "FLA":"florida-panthers","LAK":"los-angeles-kings","MIN":"minnesota-wild",
 "MTL":"montreal-canadiens","NJD":"new-jersey-devils",
 "NSH":"nashville-predators","NYI":"new-york-islanders",
 "NYR":"new-york-rangers","OTT":"ottawa-senators",
 "PHI":"philadelphia-flyers","PIT":"pittsburgh-penguins",
 "SEA":"seattle-kraken","SJS":"san-jose-sharks",
 "STL":"st-louis-blues","TBL":"tampa-bay-lightning",
 "TOR":"toronto-maple-leafs","UTA":"utah-mammoth",
 "VAN":"vancouver-canucks","VGK":"vegas-golden-knights",
 "WPG":"winnipeg-jets","WSH":"washington-capitals",
}

class Text(HTMLParser):
 def __init__(self):
  super().__init__();self.parts=[];self.skip=0
 def handle_starttag(self,tag,attrs):
  if tag in ("script","style","noscript"):self.skip+=1
  if not self.skip and tag in ("h1","h2","h3","h4","p","li","br","div","section"):
   self.parts.append("\n")
 def handle_endtag(self,tag):
  if tag in ("script","style","noscript"):self.skip=max(0,self.skip-1)
  if not self.skip and tag in ("h1","h2","h3","h4","p","li","div","section"):
   self.parts.append("\n")
 def handle_data(self,data):
  if not self.skip:self.parts.append(data)

def parse(html,abbr,url):
 p=Text();p.feed(html)
 lines=[re.sub(r"\\s+"," ",s).strip() for s in "".join(p.parts).splitlines()]
 lines=[s for s in lines if s]
 return parse_lines(lines,abbr,url,html)

def parse_lines(lines,abbr,url,raw=""):
 """Strict offline extraction: only complete position groups; no inferred starter."""
 sections={}
 markers={
  "Forwards":"forwards","Defensive Pairings":"defense",
  "1st Powerplay Unit":"pp1","2nd Powerplay Unit":"pp2",
  "1st Penalty Kill Unit":"pk1","2nd Penalty Kill Unit":"pk2",
  "Goalies":"goalies","Injuries":"injuries"}
 current=None
 for value in lines:
  value=value.strip()
  if value in markers:
   current=markers[value];sections[current]=[];continue
  if value.startswith("Click player jersey") or "Team Cap Summary" in value or value in ("Cap Summary","Projected Cap Hit","Projected Cap Space","Current Cap Space","Active Players","Draft Picks"):
   current=None;continue
  if current and value:sections[current].append(value)
 forwards=[s for s in sections.get("forwards",[]) if s not in ("LW","C","RW")]
 defense=sections.get("defense",[])
 goalies=sections.get("goalies",[])
 def names(values,n):
  if len(values)!=n:return []
  if not all(2<=len(s)<=65 and re.fullmatch(r"[\\wÀ-ž.'’ -]+",s) and len(s.split())>=2 for s in values):return []
  return values
 fw=[names(forwards[i:i+3],3) for i in range(0,12,3)] if len(forwards)==12 else []
 df=[names(defense[i:i+2],2) for i in range(0,6,2)] if len(defense)==6 else []
 pp=[names(sections.get(k,[]),5) for k in ("pp1","pp2")]
 pk=[names(sections.get(k,[]),4) for k in ("pk1","pk2")]
 goalie_names=names(goalies,2)
 stamp=re.search(r"Last updated:\\s*(\\d{4}-\\d\\d-\\d\\dT[^\\s<]+)",raw or "\\n".join(lines))
 updated=stamp.group(1).rstrip('",') if stamp else None
 complete=bool(fw and df and goalie_names and all(fw) and all(df))
 return {"team":abbr,"source":url,"sourceUpdatedAt":updated,
  "retrievedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
  "forwards":fw if complete else [],"defense":df if complete else [],
  "goalies":goalie_names if complete else [],
  "powerplay":pp if complete and all(pp) else [],
  "penaltykill":pk if complete and all(pk) else [],
  "startingGoalie":None,"startingGoalieStatus":"unconfirmed",
  "status":"parsed_unverified_do_not_publish" if complete else "incomplete_or_unrecognized",
  "diagnostic":{"forwards":len(forwards),"defense":len(defense),"goalies":len(goalies),
                "needsRosterValidation":True,"sourceReusePermissionVerified":False}}

def normalize_name(value):
 import unicodedata
 value=unicodedata.normalize("NFKD",value)
 return re.sub(r"[^a-z]","",value.encode("ascii","ignore").decode("ascii").lower())

def roster_player_names(roster):
 """Extract current NHL roster names, supporting official API formats."""
 players=[]
 for group in ("forwards","defensemen","goalies"):
  players.extend(roster.get(group,[]))
 names=set()
 for p in players:
  first=p.get("firstName",{})
  last=p.get("lastName",{})
  first=first.get("default","") if isinstance(first,dict) else first
  last=last.get("default","") if isinstance(last,dict) else last
  name=(str(first)+" "+str(last)).strip()
  if name:names.add(normalize_name(name))
 return names

def validate_roster(result,roster):
 """Never mark source lines verified unless every player is on NHL current roster."""
 known=roster_player_names(roster)
 groups=result["forwards"]+result["defense"]+[result["goalies"]]
 missing=sorted({name for group in groups for name in group
                 if normalize_name(name) not in known})
 result["diagnostic"]["missingFromNhlRoster"]=missing
 result["diagnostic"]["rosterPlayerCount"]=len(known)
 if result["status"]=="parsed_unverified_do_not_publish" and known and not missing:
  result["status"]="roster_validated_source_permission_pending"
  result["diagnostic"]["needsRosterValidation"]=False
 return result

def fetch_nhl_roster(team):
 url="https://api-web.nhle.com/v1/roster/"+team+"/current"
 req=urllib.request.Request(url,headers={"User-Agent":"BangerNHL-RosterValidator/0.1"})
 with urllib.request.urlopen(req,timeout=15) as response:
  return json.load(response)

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--team",choices=sorted(TEAMS),default="OTT")
 ap.add_argument("--input-text",help="Use a locally supplied plain-text chart instead of fetching the website")
 ap.add_argument("--output",default="dailyfaceoff_preview.json")
 ap.add_argument("--validate-roster",action="store_true",help="Check all extracted names against NHL API")
 args=ap.parse_args()
 url="https://www.dailyfaceoff.com/teams/"+TEAMS[args.team]+"/line-combinations"
 if args.input_text:
  with open(args.input_text,encoding="utf-8") as f:raw=f.read()
  result=parse_lines([line.strip() for line in raw.splitlines() if line.strip()],args.team,url,raw)
 else:
  req=urllib.request.Request(url,headers={"User-Agent":"BangerNHL-Experimental-Importer/0.1","Accept":"text/html"})
  with urllib.request.urlopen(req,timeout=20) as response:
   if response.status!=200:raise RuntimeError("HTTP "+str(response.status))
   raw=response.read(2_000_000).decode("utf-8","replace")
  result=parse(raw,args.team,url)
 if args.validate_roster and result["status"]=="parsed_unverified_do_not_publish":
  try:validate_roster(result,fetch_nhl_roster(args.team))
  except Exception as exc:
   result["diagnostic"]["rosterValidationError"]=str(exc)
 with open(args.output,"w",encoding="utf-8") as f:
  json.dump(result,f,ensure_ascii=False,indent=2)
 print("Saved diagnostic preview:",args.output)
 print("Preview only; never published. Requires permission review and NHL roster validation.")

if __name__=="__main__":main()
