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

# Also collect individual NHL.com matchup previews, but only those published
# within the last 36 hours. Never mix historical lineups into today's games.
from urllib.parse import urljoin
class LinkParser(HTMLParser):
 def __init__(self):super().__init__();self.links=[];self.href=None;self.label=[]
 def handle_starttag(self,tag,attrs):
  if tag=="a":self.href=dict(attrs).get("href");self.label=[]
 def handle_data(self,data):
  if self.href is not None:self.label.append(data)
 def handle_endtag(self,tag):
  if tag=="a" and self.href:
   self.links.append((self.href," ".join(self.label)))
   self.href=None
def parse_preview(article_url):
 request=urllib.request.Request(article_url,headers={"User-Agent":"Mozilla/5.0"})
 with urllib.request.urlopen(request,timeout=14) as resp:raw=resp.read().decode("utf-8","replace")
 published=re.search(r'"datePublished"\s*:\s*"([^"]+)"',raw)
 if not published:return {}
 try:stamp=datetime.datetime.fromisoformat(published.group(1).replace("Z","+00:00"))
 except ValueError:return {}
 if abs((datetime.datetime.now(datetime.timezone.utc)-stamp).total_seconds())>14*24*3600:return {}
 parser=Parser();parser.feed(re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>","",raw,flags=re.I))
 content=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(parser.parts).splitlines()]
 content=[x for x in content if x]
 found={}
 for idx,line in enumerate(content):
  match=re.fullmatch(r"(.{2,55}?) projected lineup",line,re.I)
  if not match:continue
  key=match.group(1).strip().lower()
  if key not in TEAM_ABBREVS:continue
  forwards=[];defense=[];goalies=[];injured="";scratched=""
  for item in content[idx+1:idx+32]:
   if re.search(r"projected lineup$|^Status report|^RELATED",item,re.I):break
   if item.startswith("Injured:"):injured=item[8:].strip();continue
   if item.startswith("Scratched:"):scratched=item[10:].strip();continue
   names=[x.strip() for x in re.split(r"\s+[-–—]{1,2}\s+",item) if x.strip()]
   if len(names)==3 and len(forwards)<4:forwards.append(names)
   elif len(names)==2 and len(forwards)>=3 and len(defense)<3:defense.append(names)
   elif len(names)==1 and len(forwards)>=3 and len(defense)>=2 and len(goalies)<2 and re.fullmatch(r"[\wÀ-ž.'’ -]{5,55}",item):goalies.append(item)
  if len(forwards)>=3 and len(defense)>=2:
   found[key]={"name":match.group(1).strip(),"forwards":forwards,"defense":defense,"goalies":goalies,"injured":injured,"scratched":scratched,"source":article_url,"publishedAt":stamp.isoformat()}
 return found
try:
 request=urllib.request.Request("https://www.nhl.com/news/topic/game-previews/",headers={"User-Agent":"Mozilla/5.0"})
 with urllib.request.urlopen(request,timeout=15) as resp:preview_index=resp.read().decode("utf-8","replace")
 links=LinkParser();links.feed(preview_index)
 urls=[]
 for href,label in links.links:
  if "projected lineups" in label.lower():
   link=urljoin("https://www.nhl.com",href)
   if link.startswith("https://www.nhl.com/news/") and link not in urls:urls.append(link)
 for link in urls[:45]:
  try:
   for key,value in parse_preview(link).items():
    if key not in teams:teams[key]=value
  except Exception as err:print("Preview unavailable",link,str(err))
except Exception as err:print("Preview index unavailable",str(err))

# Secondary source: dedicated per-team line combinations. A lineup is kept only
# when enough players match the NHL roster (validation below).
SLUGS={"mammoth":"utah-mammoth","maple leafs":"toronto-maple-leafs","stars":"dallas-stars","jets":"winnipeg-jets","canadiens":"montreal-canadiens","oilers":"edmonton-oilers","hurricanes":"carolina-hurricanes","capitals":"washington-capitals","wild":"minnesota-wild","predators":"nashville-predators","devils":"new-jersey-devils","rangers":"new-york-rangers","blues":"st-louis-blues","flyers":"philadelphia-flyers","ducks":"anaheim-ducks","canucks":"vancouver-canucks","lightning":"tampa-bay-lightning","penguins":"pittsburgh-penguins","blue jackets":"columbus-blue-jackets","kings":"los-angeles-kings","islanders":"new-york-islanders","senators":"ottawa-senators","sabres":"buffalo-sabres","kraken":"seattle-kraken"}
SLUGS.update({"golden knights":"vegas-golden-knights","bruins":"boston-bruins","red wings":"detroit-red-wings","panthers":"florida-panthers","avalanche":"colorado-avalanche","blackhawks":"chicago-blackhawks","flames":"calgary-flames","sharks":"san-jose-sharks"})
class TableParser(HTMLParser):
 def __init__(self):super().__init__();self.rows=[];self.row=None;self.cell=None;self.section="";self.heading=None
 def handle_starttag(self,tag,attrs):
  if tag in ("h1","h2","h3","h4"):self.heading=[]
  if tag=="tr":self.row=[]
  if tag in ("td","th") and self.row is not None:self.cell=[]
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
  if self.heading is not None:self.heading.append(data)
 def handle_endtag(self,tag):
  if tag in ("h1","h2","h3","h4") and self.heading is not None:
   title=" ".join(" ".join(self.heading).lower().split());self.heading=None
   if "forward" in title:self.section="forwards"
   elif "defense" in title or "defence" in title:self.section="defense"
   elif "goalie" in title:self.section="goalies"
   elif "power play" in title:self.section="powerplay"
   elif "penalty kill" in title:self.section="penaltykill"
   elif "injur" in title:self.section="injured"
  if tag in ("td","th") and self.cell is not None:
   self.row.append(" ".join(" ".join(self.cell).split()));self.cell=None
  if tag=="tr" and self.row is not None:
   self.rows.append((self.section,self.row));self.row=None
def strip_player(cell):
 cell=re.sub(r"\\s*#\\d+\\b.*$","",cell).strip()
 cell=re.sub(r"\\s*\\([^)]*\\)","",cell).strip()
 return cell
def parse_secondary(raw):
 parser=TableParser();parser.feed(re.sub(r"<(script|style)\\b[^>]*>[\\s\\S]*?</\\1>","",raw,flags=re.I))
 fw=[];df=[];pp=[]
 for section,cells in parser.rows:
  names=[strip_player(c) for c in cells]
  if section=="forwards" and len(names)>=4 and len(fw)<4 and re.search(r"line\\s*\\d",names[0],re.I):
   fw.append(names[1:4])
  elif section=="defense" and len(names)>=3 and len(df)<3 and re.search(r"pair\\s*\\d",names[0],re.I):
   df.append(names[1:3])
  elif section=="powerplay" and len(names)>=6 and len(pp)<2 and re.search(r"PP\s*[12]|power\s*play\s*[12]",names[0],re.I):pp.append(names[1:6])
 return fw,df,pp,len(parser.rows)
for key,slug in SLUGS.items():
 if key in teams:continue
 url="https://www.fsroundup.com/nhl/line-combinations/"+slug
 try:
  req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0 (compatible; BangerNHL/1.0)","Accept":"text/html"})
  with urllib.request.urlopen(req,timeout=12) as resp:
   raw=resp.read().decode("utf-8","replace")
   print("Secondary HTTP",key,resp.status,"bytes",len(raw))
  fw,df,pp,row_count=parse_secondary(raw)
  print("Secondary parsed",key,"rows",row_count,"forwards",len(fw),"defense",len(df))
  if len(fw)>=3 and len(df)>=2:
   teams[key]={"name":key.title(),"forwards":fw,"defense":df,"goalies":[],"injured":"","scratched":"","powerplay":pp,"source":url,"sourceType":"secondary"}
 except Exception as err:print("Secondary unavailable",key,str(err))
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
if len(teams)<1:raise SystemExit("No validated projections; retaining previous data")
# Keep a dated archive of validated projections for teams not featured today.
# Historical records remain explicitly labelled and are never promoted to today's projection.
ARCHIVE_FILE="lineups_archive.json"
try:
 with open(ARCHIVE_FILE,encoding="utf-8") as af:archive=json.load(af)
except (FileNotFoundError,ValueError):archive={"teams":{}}
for key,team in teams.items():
 record=dict(team)
 record["asOf"]=(record.get("publishedAt") or datetime.datetime.now(datetime.timezone.utc).isoformat())[:10]
 record["source"]=record.get("source",URL)
 record["sourceLabel"]="NHL.com" if "nhl.com" in record["source"] else "Externí zdroj"
 record["basis"]="Archiv projekce NHL (nemusí platit pro další zápas)"
 archive["teams"][key]=record
with open(ARCHIVE_FILE,"w",encoding="utf-8") as af:json.dump(archive,af,ensure_ascii=False,indent=2)
out={"source":URL,"fetchedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":teams,"rosterValidated":True}
with open("lineups.json","w",encoding="utf-8") as f:json.dump(out,f,ensure_ascii=False,indent=2)
print("Saved",len(teams),"projected lineups")
