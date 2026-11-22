"""Fetch dated projected NHL starting goalies. Never infer confirmed starts."""
import json,re,datetime,urllib.request,urllib.error,html
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
def source_shows_date(lines,day):
 """Require an explicit game-day date near the top of the visible source page."""
 header=" ".join(lines[:150])
 month=day.strftime("%B")
 short_month=day.strftime("%b")
 patterns=(
  r"(?<!\d)"+re.escape(day.isoformat())+r"(?!\d)",
  r"\b(?:"+re.escape(month)+r"|"+re.escape(short_month)+r"\.?)\s+"+str(day.day)+r"(?:st|nd|rd|th)?[,]?\s*"+str(day.year)+r"\b",
  r"\b"+str(day.day)+r"\s+(?:"+re.escape(month)+r"|"+re.escape(short_month)+r"\.?)\s+"+str(day.year)+r"\b",
 )
 return any(re.search(pattern,header,re.I) for pattern in patterns)
def source_failure_kind(error):
 """Classify errors for diagnostics; no effect on starter acceptance."""
 if isinstance(error,ValueError) and "no visible content" in str(error):
  return "empty_visible_page"
 if isinstance(error,ValueError) and "does not show today's date" in str(error):
  return "missing_current_date"
 if isinstance(error,(TimeoutError,urllib.error.URLError)):
  return "source_unreachable"
 if isinstance(error,UnicodeError):
  return "invalid_source_content"
 return "source_processing_error"
def specialist_page_health(lines, day):
 """Classify visible page coverage without treating an empty page as a valid projection."""
 if not lines:
  return "empty_visible_page"
 if not source_shows_date(lines,day):
  return "missing_current_date"
 return "dated_page"

def preview_matches_game(url, day, game):
 """Accept only a dated NHL preview naming both teams in the scheduled matchup."""
 when=datetime.date.fromisoformat(day)
 suffix=f"-game-preview-{when.strftime('%B').lower()}-{when.day}-{when.year}"
 prefix="https://www.nhl.com/news/"
 if not url.startswith(prefix) or not url.endswith(suffix):return False
 slug="-"+url[len(prefix):-len(suffix)]+"-"
 for side in ("awayTeam","homeTeam"):
  name=game[side].get("commonName",{}).get("default","")
  if not name or "-"+name.lower().replace(" ","-")+"-" not in slug:return False
 return True

def retain_game_evidence(previous,today,games,records,conflicts):
 if previous.get("date")!=today:return
 for issue in previous.get("conflicts",[]):
  team=issue.get("team")
  game=games.get(team)
  if not game or issue.get("date",today)!=today:continue
  if issue.get("gameId") is None:
   # Older exports used only the team. A previous-game preview is not evidence here.
   if issue.get("nhlSource") and not preview_matches_game(issue["nhlSource"],today,game):continue
   issue={**issue,"date":today,"gameId":game["id"]}
  if issue["gameId"]!=game["id"]:continue
  if not any(c["team"]==team for c in conflicts):conflicts.append(issue)
  records.pop(team,None)
 for team,entry in previous.get("teams",{}).items():
  if (games.get(team) and entry.get("gameId")==games[team]["id"] and entry.get("date")==today
      and entry.get("status")=="confirmed" and entry.get("confirmationBasis")=="explicit_pregame_report"
      and isinstance(entry.get("confirmationEvidence"),str) and entry["confirmationEvidence"].strip()):
   records[team]=entry

def main():
 with open("nhl_rosters.json",encoding="utf-8") as f:rosters=json.load(f).get("teams",{})
 today=datetime.datetime.now(datetime.timezone.utc).date().isoformat()
 try:
  with open("starting_goalies.json",encoding="utf-8") as old_feed:previous=json.load(old_feed)
 except (FileNotFoundError,ValueError):previous={}
 records={}
 conflicts=[]
 source_errors=[]
 blocked=set()
 try:
  req=urllib.request.Request(SOURCE,headers={"User-Agent":"Mozilla/5.0","Accept":"text/html"})
  with urllib.request.urlopen(req,timeout=20) as r:page=r.read().decode("utf-8","replace")
  parser=Extract();parser.feed(page)
  lines=[re.sub(r"\s+"," ",html.unescape(x)).strip() for x in "".join(parser.parts).splitlines()]
  lines=[x for x in lines if x]
  # A date must be present. The source may serve yesterday's page.
  page_health=specialist_page_health(lines, datetime.datetime.now(datetime.timezone.utc).date())
  if page_health=="empty_visible_page":
   raise ValueError("Source has no visible content")
  if page_health=="missing_current_date":
   raise ValueError("Source does not show today's date")
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
 except Exception as err:
  source_errors.append("specialist ["+source_failure_kind(err)+"]: "+type(err).__name__+": "+str(err)[:160])
  print("Specialist source failed; using NHL fallback:",type(err).__name__,str(err)[:160])
 # Supplement the specialist feed with NHL.com's own dated projected lineups.
 # Only use a source article published recently AND a team scheduled today.
 # The first goalie listed in an NHL projected lineup is a projection, not confirmation.
 schedule_url="https://api-web.nhle.com/v1/schedule/"+today
 try:
  request=urllib.request.Request(schedule_url,headers={"User-Agent":"BangerNHL/1.0"})
  with urllib.request.urlopen(request,timeout=12) as response:schedule=json.load(response)
  games={}
  ambiguous=set()
  for day in schedule.get("gameWeek",[]):
   if day.get("date")!=today:continue
   for game in day.get("games",[]):
    for side in ("homeTeam","awayTeam"):
     abbr=game.get(side,{}).get("abbrev")
     if abbr not in ABBR or not game.get("id"):continue
     if abbr in games:ambiguous.add(abbr)
     games[abbr]=game
  for abbr in ambiguous:games.pop(abbr,None)
  now=datetime.datetime.now(datetime.timezone.utc)
  playing={team for team,game in games.items() if game.get("gameState") in ("FUT","PRE") and
           game.get("startTimeUTC") and datetime.datetime.fromisoformat(game["startTimeUTC"].replace("Z","+00:00"))>now}
  with open("lineups.json",encoding="utf-8") as lineup_file:lineups=json.load(lineup_file).get("teams",{})
  records={abbr:{**entry,"gameId":games[abbr]["id"]} for abbr,entry in records.items() if abbr in playing}
  # Do not present a goalie for a team whose game cannot be verified.
  for abbr in playing:
   key=ABBR[abbr]
   lineup=lineups.get(key,{})
   stamp=lineup.get("publishedAt")
   if not stamp or not preview_matches_game(lineup.get("source",""),today,games[abbr]):continue
   try:
    published=datetime.datetime.fromisoformat(stamp.replace("Z","+00:00"))
    age=(datetime.datetime.now(datetime.timezone.utc)-published).total_seconds()
    if not 0<=age<=36*3600:continue
   except (ValueError,TypeError):continue
   candidates=lineup.get("goalies",[])
   if not candidates:continue
   name=candidates[0]
   if normalize(name) not in {normalize(g) for g in rosters.get(key,{}).get("goalies",[])}:continue
   nhl_entry={"gameId":games[abbr]["id"],"name":name,"status":"projected","date":today,"source":lineup["source"],"sourceLabel":"NHL.com projected lineup","checkedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"evidence":"first_listed_goalie","sourcePublishedAt":stamp}
   old=records.get(abbr)
   if old and normalize(old["name"])!=normalize(name):
    conflicts.append({"date":today,"gameId":games[abbr]["id"],"team":abbr,"specialist":old["name"],"nhl":name,"nhlSource":lineup["source"]})
    # Contradictory evidence is not a reliable starter prediction.
    records.pop(abbr,None)
    blocked.add(abbr)
   elif not old and abbr not in blocked:records[abbr]=nhl_entry
  retain_game_evidence(previous,today,games,records,conflicts)
 except Exception as err:
  # Without the official game schedule, specialist projections cannot be
  # tied to an actual game day. Fail closed instead of publishing guesses.
  records.clear()
  if previous.get("date")==today:
   conflicts=previous.get("conflicts",[])
   # Keep the original observation and game identity during a schedule outage.
   for team,entry in previous.get("teams",{}).items():
    if entry.get("gameId") and entry.get("status")=="confirmed" and entry.get("confirmationBasis")=="explicit_pregame_report" and entry.get("confirmationEvidence"):
     records[team]=entry
  source_errors.append("NHL fallback ["+source_failure_kind(err)+"]: "+type(err).__name__+": "+str(err)[:160])
  print("NHL lineup goalie fallback unavailable:",type(err).__name__,str(err)[:160])
 with open("starting_goalies.json","w",encoding="utf-8") as f:json.dump({"date":today,"updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"teams":records,"conflicts":conflicts,"sourceErrors":source_errors,"status":"unavailable" if not records else "partial"},f,ensure_ascii=False,indent=2)
 print("Game-day goalie projections:",len(records))
if __name__=="__main__":
 try:
  main()
 except Exception as exc:
  print("GOALIE SOURCE ERROR:",type(exc).__name__,str(exc))
  # Publish a transparent empty feed rather than silently reusing yesterday's starters.
  now=datetime.datetime.now(datetime.timezone.utc)
  with open("starting_goalies.json","w",encoding="utf-8") as f:
   json.dump({"date":now.date().isoformat(),"updatedAt":now.isoformat(),"teams":{},"status":"unavailable","sourceErrors":["collector: "+type(exc).__name__+": "+str(exc)[:160]],"conflicts":[],"errorType":type(exc).__name__},f,indent=2)
  print("Published empty goalie feed; no starter is claimed as confirmed or projected")

