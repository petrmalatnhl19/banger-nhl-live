import json,re,datetime,urllib.request,html
from html.parser import HTMLParser
URL="https://www.nhl.com/news/nhl-lineup-projections-2026-27-season"
class Parser(HTMLParser):
 def __init__(self): super().__init__();self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ("p","h1","h2","h3","h4","li","br"):self.parts.append("\n")
 def handle_endtag(self,tag):
  if tag in ("p","h1","h2","h3","h4","li"):self.parts.append("\n")
 def handle_data(self,data):self.parts.append(data)
req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0 (compatible; BangerNHL/1.0)","Accept":"text/html"})
with urllib.request.urlopen(req,timeout=25) as resp: page=resp.read().decode("utf-8","replace")
p=Parser();p.feed(re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>","",page,flags=re.I))
lines=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(p.parts).splitlines()]
lines=[x for x in lines if x]
teams={}
for i,line in enumerate(lines):
 m=re.fullmatch(r"(.{2,55}?) projected lineup",line,re.I)
 if not m:continue
 name=m.group(1).strip()
 if name.lower() in ("projected","today"):continue
 forwards=[];defense=[];goalies=[];injured="";scratched=""
 for x in lines[i+1:i+30]:
  if re.search(r"projected lineup$|^Status report|^More from|^RELATED|^\d{1,2}:\d{2} [ap]\.m\.",x,re.I):break
  if x.startswith("Injured:"):injured=x[8:].strip();continue
  if x.startswith("Scratched:"):scratched=x[10:].strip();continue
  names=[y.strip() for y in re.split(r"\s+[-–—]{1,2}\s+",x) if y.strip()]
  if len(names)==3 and len(forwards)<4:forwards.append(names)
  elif len(names)==2 and len(forwards)>=3 and len(defense)<3:defense.append(names)
  elif len(names)==1 and len(forwards)>=3 and len(defense)>=2 and len(goalies)<2 and re.fullmatch(r"[\wÀ-ž.'’ -]{5,55}",x):goalies.append(x)
 if len(forwards)>=3 and len(defense)>=2:teams[name.lower()]={"name":name,"forwards":forwards,"defense":defense,"goalies":goalies,"injured":injured,"scratched":scratched}
# Verify projected players against the NHL's current roster for the named club.
# This prevents mixed-up article sections from appearing as trusted lineups.
TEAM_ABBREVS={"golden knights":"VGK","bruins":"BOS","red wings":"DET","panthers":"FLA","avalanche":"COL","blackhawks":"CHI","flames":"CGY","sharks":"SJS","mammoth":"UTA","maple leafs":"TOR","jets":"WPG","canadiens":"MTL","stars":"DAL","rangers":"NYR","islanders":"NYI","devils":"NJD","hurricanes":"CAR","lightning":"TBL","senators":"OTT","sabres":"BUF","penguins":"PIT","flyers":"PHI","capitals":"WSH","ducks":"ANA","kings":"LAK","kraken":"SEA","wild":"MIN","blues":"STL","predators":"NSH","oilers":"EDM","canucks":"VAN","blue jackets":"CBJ"}
def normalize(name):
 return re.sub(r"[^a-z]","",name.casefold().replace("’","'"))
validated={}
for name,team in teams.items():
 abbr=TEAM_ABBREVS.get(name)
 if not abbr:continue
 try:
  req=urllib.request.Request("https://api-web.nhle.com/v1/roster/"+abbr+"/current",headers={"User-Agent":"BangerNHL/1.0"})
  with urllib.request.urlopen(req,timeout=12) as resp: roster=json.load(resp)
  names=set()
  for group in ("forwards","defensemen","goalies"):
   for player in roster.get(group,[]):
    first=player.get("firstName",{});last=player.get("lastName",{})
    first=first.get("default","") if isinstance(first,dict) else first
    last=last.get("default","") if isinstance(last,dict) else last
    names.add(normalize(str(first)+" "+str(last)))
  projected=[x for line in team["forwards"]+team["defense"] for x in line]
  matches=sum(normalize(x) in names for x in projected)
  if matches>=int(len(projected)*0.8):
   validated[name]=team
  else:print("Skipped",name,"roster match",matches,"/",len(projected))
 except Exception as e:print("Roster validation unavailable for",name,str(e))
teams=validated
if len(teams)<2:raise SystemExit("Parser found fewer than 2 teams; retaining previous data")
out={"source":URL,"fetchedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":teams,"rosterValidated":True}
with open("lineups.json","w",encoding="utf-8") as f:json.dump(out,f,ensure_ascii=False,indent=2)
print("Saved",len(teams),"projected lineups")
