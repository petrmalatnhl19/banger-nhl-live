"""Fetch dated projected NHL starting goalies. Never infer confirmed starts."""
import json,re,datetime,urllib.request,html
from html.parser import HTMLParser
SOURCE="https://themorningpuck.com/starting-goalies"
ABBR={"ANA":"ducks","BOS":"bruins","BUF":"sabres","CAR":"hurricanes","CBJ":"blue jackets","CGY":"flames","CHI":"blackhawks","COL":"avalanche","DAL":"stars","DET":"red wings","EDM":"oilers","FLA":"panthers","LAK":"kings","MIN":"wild","MTL":"canadiens","NJD":"devils","NSH":"predators","NYI":"islanders","NYR":"rangers","OTT":"senators","PHI":"flyers","PIT":"penguins","SEA":"kraken","SJS":"sharks","STL":"blues","TBL":"lightning","TOR":"maple leafs","UTA":"mammoth","VAN":"canucks","VGK":"golden knights","WPG":"jets","WSH":"capitals"}
class Extract(HTMLParser):
 def __init__(self):super().__init__();self.parts=[];self.hidden=0
 def handle_starttag(self,tag,attrs):
  if tag in ("script","style"):self.hidden+=1
  if tag in ("h1","h2","h3","h4","p","div","li","br","tr"):self.parts.append("\n")
 def handle_endtag(self,tag):
  if tag in ("script","style"):self.hidden=max(0,self.hidden-1)
  if tag in ("h1","h2","h3","h4","p","div","li","tr"):self.parts.append("\n")
 def handle_data(self,value):
  if not self.hidden:self.parts.append(value)
def normalize(value):
 import unicodedata
 return re.sub("[^a-z]","",unicodedata.normalize("NFKD",value.casefold()).encode("ascii","ignore").decode())
def main():
 with open("nhl_rosters.json",encoding="utf-8") as f:rosters=json.load(f).get("teams",{})
 today=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
 req=urllib.request.Request(SOURCE,headers={"User-Agent":"Mozilla/5.0","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=20) as r:page=r.read().decode("utf-8","replace")
 parser=Extract();parser.feed(page)
 lines=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(parser.parts).splitlines()]
 lines=[x for x in lines if x]
 # A date must be present. The source may serve yesterday's page.
 date_tokens=[today,datetime.datetime.now(datetime.timezone.utc).strftime("%B %-d, %Y")]
 if not any(t.lower() in " ".join(lines[:150]).lower() for t in date_tokens):
  raise ValueError("Source does not show today's date")
 records={}
 # Match only full goalie names against NHL's official current roster.
 # A player name is attributed only if a team heading appears close to it.
 # Team identifiers are read directly from ABBR below; no unused dictionary needed.
 for abbr,key in ABBR.items():
  goalies=rosters.get(key,{}).get("goalies",[])
  if not goalies:continue
  for i,line in enumerate(lines):
   if not any(normalize(line)==normalize(g) for g in goalies):continue
   neighborhood=" ".join(lines[max(0,i-7):i])
   # Require the team name in preceding text, not just the goalie.
   if not (re.search(r"\b"+re.escape(abbr)+r"\b",neighborhood,re.I) or re.search(re.escape(key),neighborhood,re.I)):continue
   status="projected"
   context=" ".join(lines[i+1:i+4]).upper()
   if "PROJECTED" not in context and "LIKELY" not in context:continue
   records[abbr]={"name":line,"status":status,"date":today,"source":SOURCE,"sourceLabel":"The Morning Puck","checkedAt":datetime.datetime.now(datetime.timezone.utc).isoformat()}
   break
 # Supplement the specialist feed with NHL.com's own dated projected lineups.
 # Only use a source article published recently AND a team scheduled today.
 # The first goalie listed in an NHL projected lineup is a projection, not confirmation.
 schedule_url="https://api-web.nhle.com/v1/schedule/"+today
 try:
  request=urllib.request.Request(schedule_url,headers={"User-Agent":"BangerNHL/1.0"})
  with urllib.request.urlopen(request,timeout=12) as response:schedule=json.load(response)
  playing=set()
  for day in schedule.get("gameWeek",[]):
   if day.get("date")!=today:continue
   for game in day.get("games",[]):
    for side in ("homeTeam","awayTeam"):
     abbr=game.get(side,{}).get("abbrev")
     if abbr in ABBR:playing.add(abbr)
  with open("lineups.json",encoding="utf-8") as lineup_file:lineups=json.load(lineup_file).get("teams",{})
  for abbr in playing:
   if abbr in records:continue
   key=ABBR[abbr]
   lineup=lineups.get(key,{})
   stamp=lineup.get("publishedAt")
   if not stamp or "nhl.com/news/" not in lineup.get("source",""):continue
   try:
    published=datetime.datetime.fromisoformat(stamp.replace("Z","+00:00"))
    age=(datetime.datetime.now(datetime.timezone.utc)-published).total_seconds()
    if not 0<=age<=36*3600:continue
   except (ValueError,TypeError):continue
   candidates=lineup.get("goalies",[])
   if not candidates:continue
   name=candidates[0]
   if normalize(name) not in {normalize(g) for g in rosters.get(key,{}).get("goalies",[])}:continue
   records[abbr]={"name":name,"status":"projected","date":today,"source":lineup["source"],"sourceLabel":"NHL.com projected lineup","checkedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"evidence":"first_listed_goalie","sourcePublishedAt":stamp}
 except Exception as err:print("NHL lineup goalie fallback unavailable:",type(err).__name__,str(err)[:160])
 with open("starting_goalies.json","w",encoding="utf-8") as f:json.dump({"date":today,"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":records},f,ensure_ascii=False,indent=2)
 print("Verified source-matched projected goalies:",len(records))
if __name__=="__main__":
 try:
  main()
 except Exception as exc:
  print("GOALIE SOURCE ERROR:",type(exc).__name__,str(exc))
  # Publish a transparent empty feed rather than silently reusing yesterday's starters.
  now=datetime.datetime.now(datetime.timezone.utc)
  with open("starting_goalies.json","w",encoding="utf-8") as f:
   json.dump({"date":now.date().isoformat(),"updatedAt":now.isoformat(),"teams":{},"status":"source_unavailable","errorType":type(exc).__name__},f,indent=2)
  print("Published empty goalie feed; no starter is claimed as confirmed or projected")

