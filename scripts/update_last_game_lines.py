"""Supplement missing projections with sourced, dated 5v5 lines from DeepMetric.
These are last-game combinations, never advertised as confirmed starters.
No existing verified projections are overwritten.
"""
import json,re,datetime,urllib.request,html
from html.parser import HTMLParser
URL="https://deepmetricanalytics.com/nhl/lines"
TEAM_NAMES={"ducks":"anaheim","bruins":"boston","sabres":"buffalo","flames":"calgary","hurricanes":"carolina","blackhawks":"chicago","avalanche":"colorado","blue jackets":"columbus","stars":"dallas","red wings":"detroit","oilers":"edmonton","panthers":"florida","kings":"los angeles","wild":"minnesota","canadiens":"montreal","predators":"nashville","devils":"new jersey","islanders":"new york islanders","rangers":"new york rangers","senators":"ottawa","flyers":"philadelphia","penguins":"pittsburgh","sharks":"san jose","kraken":"seattle","blues":"st louis","lightning":"tampa bay","maple leafs":"toronto","mammoth":"utah","canucks":"vancouver","golden knights":"vegas","capitals":"washington","jets":"winnipeg"}
class Text(HTMLParser):
 def __init__(self):super().__init__();self.lines=[];self.current=[];self.in_script=0
 def handle_starttag(self,t,a):
  if t in ("script","style"):self.in_script+=1
  if t in ("tr","p","h1","h2","h3","h4","li","br"):self.flush()
  if t in ("td","th"):self.current.append(" | ")
 def handle_endtag(self,t):
  if t in ("script","style"):self.in_script=max(0,self.in_script-1)
  if t in ("tr","p","h1","h2","h3","h4","li"):self.flush()
 def handle_data(self,d):
  if not self.in_script:self.current.append(d)
 def flush(self):
  v=" ".join(html.unescape("".join(self.current)).split()).strip(" |")
  if v:self.lines.append(v)
  self.current=[]
def norm(s):return re.sub(r"[^a-z]","",s.lower())
def names(s,count):
 s=re.sub(r"^(?:L[1-4]|D[1-3]|PP[12])\\s*(?:\\||:|–|-)?\\s*","",s,flags=re.I)
 p=[x.strip() for x in re.split(r"\\s*[·|]\\s*|\\s+[–—]\\s+",s) if x.strip()]
 return p if len(p)==count and all(2<=len(x)<=60 for x in p) else []
def run():
 req=urllib.request.Request(URL,headers={"User-Agent":"Mozilla/5.0","Accept":"text/html"})
 with urllib.request.urlopen(req,timeout=25) as r:raw=r.read().decode("utf-8","replace")
 p=Text();p.feed(raw);p.flush()
 with open("nhl_rosters.json",encoding="utf-8") as f:rosters=json.load(f).get("teams",{})
 with open("lineups_archive.json",encoding="utf-8") as f:archive=json.load(f)
 entries=archive.setdefault("teams",{})
 current=None;candidate={};count=0
 def save():
  nonlocal count
  if not current:return
  if len(candidate.get("forwards",[]))<3 or len(candidate.get("defense",[]))<2:return
  roster=rosters.get(current,{})
  valid={norm(x.split()[-1]) for grp in ("forwards","defense","goalies") for x in roster.get(grp,[]) if x}
  projected=[x for unit in candidate["forwards"]+candidate["defense"] for x in unit]
  hits=sum(norm(x.split()[-1]) in valid for x in projected)
  if hits/len(projected)<0.75:
   print("Rejected",current,"matched",hits,len(projected));return
  if current in entries:return
  record=dict(candidate)
  record.update(name=current.title(),source=URL,sourceLabel="DeepMetric Analytics",basis="Formace z posledního utkání (nikoli potvrzená sestava pro další zápas)",asOf=datetime.datetime.now(datetime.timezone.utc).date().isoformat(),goalies=[])
  entries[current]=record;count+=1
 for line in p.lines:
  lowered=line.lower()
  found=next((key for key,city in TEAM_NAMES.items() if re.search(r"\\b"+re.escape(city)+r"\\s+"+re.escape(key)+r"\\b",lowered)),None)
  if found:
   save();current=found;candidate={"forwards":[],"defense":[],"powerplay":[]};continue
  if not current:continue
  m=re.match(r"^(L[1-4]|D[1-3]|PP[12])\\s*(?:\\||:|–|-)?\\s*(.*)",line,re.I)
  if not m:continue
  label=m.group(1).upper();rest=m.group(2)
  expected=3 if label.startswith("L") else 2 if label.startswith("D") else 5
  unit=names(rest,expected)
  if not unit:continue
  group="forwards" if label.startswith("L") else "defense" if label.startswith("D") else "powerplay"
  if len(candidate[group])<(4 if group=="forwards" else 3 if group=="defense" else 2):candidate[group].append(unit)
 save()
 if count:
  with open("lineups_archive.json","w",encoding="utf-8") as f:json.dump(archive,f,ensure_ascii=False,indent=2)
 print("DeepMetric fallback added",count,"teams; archive total",len(entries))
if __name__=="__main__":
 try:run()
 except Exception as e:print("Optional DeepMetric fallback unavailable:",repr(e))
