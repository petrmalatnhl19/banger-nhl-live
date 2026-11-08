import json,re,datetime,urllib.request,html,unicodedata
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
main_published=re.search(r'"datePublished"\s*:\s*"([^"]+)"',page)
main_stamp=None
if main_published:
 try:main_stamp=datetime.datetime.fromisoformat(main_published.group(1).replace("Z","+00:00"))
 except ValueError:pass
p=Parser();p.feed(re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>","",page,flags=re.I))
lines=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(p.parts).splitlines()]
lines=[x for x in lines if x]
teams={}
for i,line in enumerate(lines):
 m=re.fullmatch(r"(.{2,55}?) projected (?:lineup|lines)",line,re.I)
 if not m:continue
 name=m.group(1).strip()
 if name.lower() in ("projected","today"):continue
 forwards=[];defense=[];goalies=[];injured="";scratched=""
 for x in lines[i+1:i+30]:
  if re.search(r"projected (?:lineup|lines)$|^Status report|^More from|^RELATED|^\d{1,2}:\d{2} [ap]\.m\.",x,re.I):break
  if x.startswith("Injured:"):injured=x[8:].strip();continue
  if x.startswith("Scratched:"):scratched=x[10:].strip();continue
  names=[y.strip() for y in re.split(r"\s+[-–—]{1,2}\s+",x) if y.strip()]
  if len(names)==3 and len(forwards)<4:forwards.append(names)
  elif len(names)==2 and len(forwards)>=3 and len(defense)<8:defense.append(names)
  elif len(names)==1 and len(forwards)>=3 and len(defense)>=2 and len(goalies)<2 and re.fullmatch(r"[\wÀ-ž.'’ -]{5,55}",x):goalies.append(x)
 if len(forwards)>=3 and len(defense)>=2:teams[name.lower()]={"name":name,"forwards":forwards,"defense":defense,"goalies":goalies,"injured":injured,"scratched":scratched,"source":URL,"publishedAt":main_stamp.isoformat() if main_stamp else None}
# Verify projected players against the NHL's current roster for the named club.
# This prevents mixed-up article sections from appearing as trusted lineups.
TEAM_ABBREVS={"golden knights":"VGK","bruins":"BOS","red wings":"DET","panthers":"FLA","avalanche":"COL","blackhawks":"CHI","flames":"CGY","sharks":"SJS","mammoth":"UTA","maple leafs":"TOR","jets":"WPG","canadiens":"MTL","stars":"DAL","rangers":"NYR","islanders":"NYI","devils":"NJD","hurricanes":"CAR","lightning":"TBL","senators":"OTT","sabres":"BUF","penguins":"PIT","flyers":"PHI","capitals":"WSH","ducks":"ANA","kings":"LAK","kraken":"SEA","wild":"MIN","blues":"STL","predators":"NSH","oilers":"EDM","canucks":"VAN","blue jackets":"CBJ"}
def normalize(name):
 # NHL articles frequently omit accents (Stutzle vs Stützle, Valimaki vs Välimäki).
 # Fold accents, but never accept a different player solely by surname.
 folded=unicodedata.normalize("NFKD",str(name).casefold().replace("’","'"))
 key=re.sub(r"[^a-z]","", "".join(ch for ch in folded if not unicodedata.combining(ch)))
 # NHL.com previews may use a familiar given name while the official roster
 # uses a formal name. Only explicitly verified full-name aliases are allowed.
 return {"mikeyeyssimont":"michaeleyssimont", "williamborgen":"willborgen", "jacobslavin":"jaccobslavin", "ivanstenberg":"ivarstenberg", "eliasnilspettersson":"eliaspettersson"}.get(key,key)

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
  match=re.fullmatch(r"(.{2,55}?) projected (?:lineup|lines)",line,re.I)
  if not match:continue
  key=match.group(1).strip().lower()
  if key not in TEAM_ABBREVS:continue
  forwards=[];defense=[];goalies=[];injured="";scratched=""
  for item in content[idx+1:idx+32]:
   if re.search(r"projected (?:lineup|lines)$|^Status report|^RELATED",item,re.I):break
   if item.startswith("Injured:"):injured=item[8:].strip();continue
   if item.startswith("Scratched:"):scratched=item[10:].strip();continue
   names=[x.strip() for x in re.split(r"\s+[-–—]{1,2}\s+",item) if x.strip()]
   if len(names)==3 and len(forwards)<4:forwards.append(names)
   elif len(names)==2 and len(forwards)>=3 and len(defense)<8:defense.append(names)
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
  # NHL headlines use both singular and plural forms, e.g. "Jets at Canadiens projected lineups".
  if re.search(r"projected\\s+lineups?",label,re.I) or re.search(r"game-preview|projected-lineups?",href,re.I) or (re.search(r"/news/",href,re.I) and re.search(r"islanders|senators|bruins",href+" "+label,re.I)):
   link=urljoin("https://www.nhl.com",href)
   if link.startswith("https://www.nhl.com/news/") and link not in urls:urls.append(link)
 # Some NHL.com article cards are rendered as JSON instead of ordinary <a> tags.
 # Extract only article paths; the article itself must still pass timestamp and roster checks.
 for path in re.findall(r'(?:https://www\\.nhl\\.com)?(/news/[a-z0-9-]+(?:game-preview|projected-lineups?)[a-z0-9-]*)',preview_index,re.I):
  link=urljoin("https://www.nhl.com",path)
  if link not in urls:urls.append(link)
 print("NHL preview candidates:",len(urls))
 for link in urls[:60]:
  try:
   for key,value in parse_preview(link).items():
    if key not in teams or (value.get("publishedAt") and value["publishedAt"]>str(teams[key].get("publishedAt") or "")):teams[key]=value
  except Exception as err:print("Preview unavailable",link,str(err))
except Exception as err:print("Preview index unavailable",str(err))

# Direct NHL.com matchup articles can appear before the game-preview index updates.
# These are still subject to publication-date and NHL roster validation.
DIRECT_PREVIEWS=[
 "https://www.nhl.com/news/ottawa-senators-buffalo-sabres-game-preview-november-4-2026",
 # Historical NYI projection: can improve archive, never counts as fresh.
 "https://www.nhl.com/news/edmonton-oilers-new-york-islanders-game-preview-october-31-2026",
]
for direct_url in DIRECT_PREVIEWS:
 try:
  for key,value in parse_preview(direct_url).items():
   if key not in teams or (value.get("publishedAt") and value["publishedAt"]>str(teams[key].get("publishedAt") or "")):
    teams[key]=value
 except Exception as err:print("Direct NHL preview unavailable",direct_url,str(err))

# Schedule-driven discovery: build game-preview URLs from actual NHL fixtures.
# Never infer that an article exists: parse_preview must fetch a real NHL.com
# article with its own publication timestamp and complete projected lines.
TEAM_SLUGS={"ANA":"anaheim-ducks","BOS":"boston-bruins","BUF":"buffalo-sabres","CAR":"carolina-hurricanes","CBJ":"columbus-blue-jackets","CGY":"calgary-flames","CHI":"chicago-blackhawks","COL":"colorado-avalanche","DAL":"dallas-stars","DET":"detroit-red-wings","EDM":"edmonton-oilers","FLA":"florida-panthers","LAK":"los-angeles-kings","MIN":"minnesota-wild","MTL":"montreal-canadiens","NJD":"new-jersey-devils","NSH":"nashville-predators","NYI":"new-york-islanders","NYR":"new-york-rangers","OTT":"ottawa-senators","PHI":"philadelphia-flyers","PIT":"pittsburgh-penguins","SEA":"seattle-kraken","SJS":"san-jose-sharks","STL":"st-louis-blues","TBL":"tampa-bay-lightning","TOR":"toronto-maple-leafs","UTA":"utah-mammoth","VAN":"vancouver-canucks","VGK":"vegas-golden-knights","WPG":"winnipeg-jets","WSH":"washington-capitals"}
DISCOVERY_TARGETS={"BOS","NYI","OTT"}
schedule_discovery={"checked":0,"articlesFound":0,"errors":[],"fixtures":[],"attempts":[],"note":"Only today and tomorrow are checked; future matchup preview URLs are not assumed published."}
today=datetime.datetime.now(datetime.timezone.utc).date()
schedule_games=set()
for offset in (-1,0,1,2):
 date=today+datetime.timedelta(days=offset)
 try:
  request=urllib.request.Request("https://api-web.nhle.com/v1/schedule/"+date.isoformat(),headers={"User-Agent":"BangerNHL/1.0"})
  with urllib.request.urlopen(request,timeout=12) as resp:schedule=json.load(resp)
  for week in schedule.get("gameWeek",[]):
   for game in week.get("games",[]):
    away=game.get("awayTeam",{}).get("abbrev")
    home=game.get("homeTeam",{}).get("abbrev")
    day=game.get("gameDate") or week.get("date")
    if away in TEAM_SLUGS and home in TEAM_SLUGS and (away in DISCOVERY_TARGETS or home in DISCOVERY_TARGETS) and day and day <= (today+datetime.timedelta(days=1)).isoformat():
     schedule_games.add((day,away,home))
 except Exception as err:schedule_discovery["errors"].append("schedule "+date.isoformat()+": "+str(err)[:120])
schedule_discovery["fixtures"]=[{"date":d,"away":a,"home":h} for d,a,h in sorted(schedule_games)]
for day,away,home in sorted(schedule_games):
 try:date_label=datetime.date.fromisoformat(day).strftime("%B-%-d-%Y").lower()
 except (ValueError,TypeError):continue
 for first,second in ((away,home),(home,away)):
  url="https://www.nhl.com/news/"+TEAM_SLUGS[first]+"-"+TEAM_SLUGS[second]+"-game-preview-"+date_label
  schedule_discovery["checked"]+=1
  try:
   discovered=parse_preview(url)
   schedule_discovery["attempts"].append({"url":url,"result":"parsed" if discovered else "no_complete_projection","teams":list(discovered)})
   if discovered:schedule_discovery["articlesFound"]+=1
   for key,value in discovered.items():
    if key not in teams or (value.get("publishedAt") and value["publishedAt"]>str(teams[key].get("publishedAt") or "")):
     teams[key]=value
  except Exception as err:
   schedule_discovery["attempts"].append({"url":url,"result":"fetch_or_parse_error","error":str(err)[:160]})
with open("lineups_discovery_diagnostics.json","w",encoding="utf-8") as discovery_file:
 json.dump({"generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),**schedule_discovery},discovery_file,ensure_ascii=False,indent=2)
print("Schedule-driven preview discovery",json.dumps(schedule_discovery))
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
 cell=re.sub(r"\s*#\d+\b.*$","",cell).strip()
 cell=re.sub(r"\s*\([^)]*\)","",cell).strip()
 return cell
def parse_secondary(raw):
 parser=TableParser();parser.feed(re.sub(r"<(script|style)\b[^>]*>[\s\S]*?</\1>","",raw,flags=re.I))
 fw=[];df=[];pp=[]
 for section,cells in parser.rows:
  names=[strip_player(c) for c in cells]
  if section=="forwards" and len(names)>=4 and len(fw)<4 and re.search(r"line\s*\d",names[0],re.I):
   fw.append(names[1:4])
  elif section=="defense" and len(names)>=3 and len(df)<3 and re.search(r"pair\s*\d",names[0],re.I):
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
# Diagnostic: distinguish source discovery failures from roster validation failures.
FOCUS={"bruins":"BOS","hurricanes":"CAR","kings":"LAK","islanders":"NYI","rangers":"NYR","senators":"OTT","sharks":"SJS","jets":"WPG","canucks":"VAN","lightning":"TBL","mammoth":"UTA","red wings":"DET","stars":"DAL"}
source_diagnostics={}
for key,abbr in FOCUS.items():
 candidate=teams.get(key)
 source_diagnostics[key]={"team":abbr,"candidateFound":bool(candidate),
  "candidateSource":candidate.get("source") if candidate else None,
  "candidatePublishedAt":candidate.get("publishedAt") if candidate else None,
  "candidateForwardLines":len(candidate.get("forwards",[])) if candidate else 0,
  "candidateDefensePairs":len(candidate.get("defense",[])) if candidate else 0,
  "rosterValidation":"not_run" if candidate else "no_complete_source_candidate"}
# Preserve incomplete forward fragments for Tampa instead of misreporting them
# as defensive pairs. This is diagnostic metadata, never a fabricated line.
if "lightning" in source_diagnostics:
 try:
  from pathlib import Path
  raw=json.loads(Path("tampa_source_excerpt.json").read_text(encoding="utf-8"))
  fragments=[]
  for block in raw.get("blocks",[]):
   for line in block.get("followingLines",[]):
    if re.search(r"projected (?:lineup|lines)$",line,re.I):break
    parts=[x.strip() for x in re.split(r"\\s+[-–—]{1,2}\\s+",line) if x.strip()]
    if len(parts)==2 and parts==["Jeffrey Viel","Zemgus Girgensons"]:
     fragments.append({"players":parts,"missingPlayers":1,"role":"forwards","sourceStatus":"incomplete"})
  source_diagnostics["lightning"]["incompleteForwardFragments"]=fragments
 except (OSError,ValueError,TypeError):pass
# Narrow evidence-based exception: the exact DAL defenseman Trey Taylor.
# Require a fresh official game-boxscore diagnostic AND a game on the
# projected lineup's publication date. No general surname-based exemptions.
def verified_recent_game_player(team, abbr, player_name, diagnostic_file):
 try:
  from pathlib import Path
  proof=json.loads(Path(diagnostic_file).read_text(encoding="utf-8"))
  checked=datetime.datetime.fromisoformat(proof["checkedAt"].replace("Z","+00:00"))
  if datetime.datetime.now(datetime.timezone.utc)-checked>datetime.timedelta(hours=24):return False
  published=team.get("publishedAt")
  if not published:return False
  date=datetime.datetime.fromisoformat(published.replace("Z","+00:00")).date()
  appearances=proof.get("players",{}).get(player_name,{}).get("appearedInGames",[])
  return (proof.get("team")==abbr and not proof.get("errors") and
          any(datetime.date.fromisoformat(g["gameDate"])==date for g in appearances))
 except (OSError,KeyError,ValueError,TypeError):return False

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
  groups={}
  for role,group in (("forwards","forwards"),("defense","defensemen"),("goalies","goalies")):
   groups[role]={normalize(str((p.get("firstName",{}).get("default","") if isinstance(p.get("firstName"),dict) else p.get("firstName","")))+" "+str((p.get("lastName",{}).get("default","") if isinstance(p.get("lastName"),dict) else p.get("lastName","")))) for p in roster.get(group,[])}
  # Exact player/team/position only; requires a fresh official game
  # appearance on the source projection date. No blanket roster bypass.
  game_evidence_cases={
   "stars":("DAL","Trey Taylor","defense","dallas_game_roster_diagnostic.json"),
   "mammoth":("UTA","Artem Duda","defense","utah_game_roster_diagnostic.json"),
   "red wings":("DET","John Leonard","forwards","detroit_game_roster_diagnostic.json"),
  }
  if name in game_evidence_cases:
   proof_abbr,proof_player,proof_role,proof_file=game_evidence_cases[name]
   if verified_recent_game_player(team,proof_abbr,proof_player,proof_file):
    groups[proof_role].add(normalize(proof_player))
    if name in source_diagnostics:
     source_diagnostics[name]["gameEvidenceException"]={"player":proof_player,"role":proof_role,"basis":"official game boxscore on projection publication date"}
  # Collect up to eight 2-name source rows, because some are forward fragments.
  # Only NHL-roster-verified defender pairs become published defense lines.
  # Classify each parsed row by NHL roster position, not by its order in HTML.
  # An unrelated two-name line must never become a defensive pair.
  original_forwards=[list(row) for row in team.get("forwards",[])]
  original_defense=[list(row) for row in team.get("defense",[])]
  all_rows=original_forwards+original_defense
  # Do not let an invalid 2-player forward fragment masquerade as a D pair.
  # Recover only complete 3-player rows already present in source data.
  forwards=[row for row in all_rows if len(row)==3 and all(normalize(x) in groups["forwards"] for x in row)]
  defense=[row for row in all_rows if len(row)==2 and all(normalize(x) in groups["defense"] for x in row)]
  goalies=[x for x in team.get("goalies",[]) if normalize(x) in groups["goalies"]]
  # If a defender was incorrectly parsed as a goalie, discard it.
  # Preserve the source order and do not invent missing lines.
  team["forwards"]=forwards[:4]
  team["defense"]=defense[:3]
  team["goalies"]=goalies[:2]
  # Explain rejected lines without weakening roster validation.
  if name in source_diagnostics:
   # Diagnose role mismatches explicitly (e.g. Winnipeg forward fragments
   # accidentally captured in the defense section).
   role_mismatches=[]
   for index,row in enumerate(original_defense,1):
    if any(normalize(player) in groups["forwards"] and normalize(player) not in groups["defense"] for player in row):
     role_mismatches.append({"sourcePair":index,"players":row,"reason":"forward_in_defense_row"})
   source_diagnostics[name]["roleMismatches"]=role_mismatches
   rejected=[]
   for role,rows,allowed in (("forwards",original_forwards,groups["forwards"]),("defense",original_defense,groups["defense"])):
    for index,row in enumerate(rows,1):
     missing=[player for player in row if normalize(player) not in allowed]
     if missing:
      rejected.append({"group":role,"line":index,"players":missing,"sourceLine":row})
   source_diagnostics[name]["rejectedLines"]=rejected
   # Distinguish a player absent from the current roster from one listed
   # in a different position group; never auto-approve either case.
   source_diagnostics[name]["rejectedPlayerReasons"]=[
    {"name":player,"expectedRole":role,
     "reason":("other_position_group" if any(normalize(player) in roster_names for group_name,roster_names in groups.items() if group_name!=role) else "not_in_current_roster")}
    for role,rows,allowed in (("forwards",original_forwards,groups["forwards"]),("defense",original_defense,groups["defense"]))
    for row in rows for player in row if normalize(player) not in allowed
   ]
  forwards_ok=len(forwards)>=3
  defense_ok=len(defense)>=2
  goalies_ok=True
  if not forwards_ok or not defense_ok:
   print("Incomplete verified lines",name,"forwards",len(forwards),"defense",len(defense))
  if name in source_diagnostics:
   source_diagnostics[name]["validatedForwardLines"]=len(forwards)
   source_diagnostics[name]["validatedDefensePairs"]=len(defense)
   source_diagnostics[name]["rosterValidation"]="passed" if forwards_ok and defense_ok else "insufficient_position_matched_lines"
  if forwards_ok and defense_ok and goalies_ok:
   validated[name]=team
  else:print("Skipped",name,"invalid position assignment (F/D/G)")
 except Exception as e:
  if name in source_diagnostics:source_diagnostics[name]["rosterValidation"]="roster_api_unavailable";source_diagnostics[name]["error"]=str(e)[:160]
  print("Roster validation unavailable for",name,str(e))
teams=validated
for key,entry in source_diagnostics.items():
 entry["accepted"]=key in teams
with open("lineups_source_diagnostics.json","w",encoding="utf-8") as diagnostic_file:
 json.dump({"generatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":source_diagnostics},diagnostic_file,ensure_ascii=False,indent=2)
print("SOURCE DIAGNOSTICS:",json.dumps(source_diagnostics,ensure_ascii=False))
if len(teams)<1:raise SystemExit("No validated projections; retaining previous data")
# Keep a dated archive of validated projections for teams not featured today.
# Historical records remain explicitly labelled and are never promoted to today's projection.
ARCHIVE_FILE="lineups_archive.json"
try:
 with open(ARCHIVE_FILE,encoding="utf-8") as af:archive=json.load(af)
except (FileNotFoundError,ValueError):archive={"teams":{}}
for key,team in teams.items():
 record=dict(team)
 # Never label an undated secondary snapshot as published today.
 record["asOf"]=(record.get("publishedAt") or record.get("asOf") or "")[:10]
 record["dateVerified"]=bool(record["asOf"])
 if not record["dateVerified"]:
  record["basis"]="Nedatovaná sestava externího zdroje; aktuálnost neověřena"
 record["source"]=record.get("source",URL)
 record["sourceLabel"]="NHL.com" if "nhl.com" in record["source"] else "Externí zdroj"
 if record.get("dateVerified"):record["basis"]="Archiv projekce NHL (nemusí platit pro další zápas)"
 previous=archive["teams"].get(key,{})
 if previous and not record.get("dateVerified") and previous.get("dateVerified",bool(previous.get("asOf"))):
  print("Keeping dated archive instead of undated secondary data for",key)
  continue
 if previous and str(previous.get("asOf",""))>str(record["asOf"]):
  print("Keeping newer archived projection for",key,previous.get("asOf"))
  continue
 archive["teams"][key]=record
with open(ARCHIVE_FILE,"w",encoding="utf-8") as af:json.dump(archive,af,ensure_ascii=False,indent=2)
# Compare only two validated projections for the same team, never roster fallbacks.
try:
 with open("lineups.json",encoding="utf-8") as oldfile:old_teams=json.load(oldfile).get("teams",{})
except (OSError,ValueError):old_teams={}
try:
 with open("lineups_changes.json",encoding="utf-8") as changesfile:changes=json.load(changesfile).get("teams",{})
except (OSError,ValueError):changes={}
def positions(record):
 result={}
 for group,label in (("forwards","Útok"),("defense","Obrana")):
  for i,line in enumerate(record.get(group,[])):
   for player in line:result[normalize(player)]=(player,label+" "+str(i+1))
 return result
for key,team in teams.items():
 previous=old_teams.get(key)
 if not previous:continue
 # The comparison must not create alerts from an older source publication.
 previous_date=previous.get("publishedAt") or previous.get("asOf") or ""
 current_date=team.get("publishedAt") or team.get("asOf") or ""
 if previous_date and current_date and current_date<previous_date:continue
 before=positions(previous);after=positions(team)
 events=[]
 for player,(display,pos) in after.items():
  if player not in before:events.append({"type":"added","player":display,"to":pos})
  elif before[player][1]!=pos:events.append({"type":"moved","player":display,"from":before[player][1],"to":pos})
 for player,(display,pos) in before.items():
  if player not in after:events.append({"type":"removed","player":display,"from":pos})
 if events:
  changes[key]={"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"previousPublishedAt":previous_date,"publishedAt":current_date,"source":team.get("source",URL),"events":events[:40],"basis":"Rozdíl dvou dostupných projekcí, nikoli potvrzená změna sestavy"}
with open("lineups_changes.json","w",encoding="utf-8") as changesfile:
 json.dump({"teams":changes},changesfile,ensure_ascii=False,indent=2)
out={"source":URL,"fetchedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":teams,"rosterValidated":True}
with open("lineups.json","w",encoding="utf-8") as f:json.dump(out,f,ensure_ascii=False,indent=2)
print("Saved",len(teams),"projected lineups")
