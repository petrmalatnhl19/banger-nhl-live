"""Apply small, idempotent goalie integration patches to the existing NHL UI."""
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "index.html"
html = path.read_text(encoding="utf-8")
changes = 0

# All lineup goalie panels should use the same verified, date-scoped source.
needle = "let startingGoalies={};try{const gr=await fetch('./starting_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});"
replacement = """let rotowireGoalies={games:[]};try{const rr=await fetch('./rotowire_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});if(rr.ok)rotowireGoalies=await rr.json()}catch(e){}let startingGoalies={};try{const gr=await fetch('./starting_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});"""
if needle in html:
    html = html.replace(needle, replacement, 1)
    changes += 1

# The pregame modal is bound to an NHL game; match by game ID, team and date.
needle = "const external=startingGoalies[ab];const status=external?.status||t?.startingGoalieStatus;"
replacement = """const gameDate=(d.startTimeUTC||d.gameDate||'').slice(0,10);const rw=rotowireGoalies.games?.find(x=>x.gameId===d.id&&x.team===ab&&x.date===gameDate);const external=rw?{name:rw.goalie,status:rw.status,date:rw.date,source:rw.source,checkedAt:rotowireGoalies.updatedAt}:startingGoalies[ab]?.date===gameDate?startingGoalies[ab]:null;const status=external?.status||t?.startingGoalieStatus;"""
if needle in html:
    html = html.replace(needle, replacement, 1)
    changes += 1

# For a future game, do not silently attribute today's goalie to that date.
needle = "const [starterData,lineupData,rosterData]=await Promise.all([read('starting_goalies.json'),read('lineups.json'),read('nhl_rosters.json')]);"
replacement = "const [starterData,lineupData,rosterData,rotowireData]=await Promise.all([read('starting_goalies.json'),read('lineups.json'),read('nhl_rosters.json'),read('rotowire_goalies.json')]);"
if needle in html:
    html = html.replace(needle, replacement, 1)
    changes += 1
needle = """   const name=s?.name||l?.startingGoalie;
   const status=s?.status||l?.startingGoalieStatus;
   const checked=s?.checkedAt||l?.startingGoalieCheckedAt;
   const source=s?.source||l?.startingGoalieSource;"""
replacement = """   const rw=(rotowireData?.games||[]).find(g=>g.date===day&&g.team===code&&g.opponent===(code===ac?hc:ac));
   const current=s?.date===day?s:null;
   const selected=rw?{name:rw.goalie,status:rw.status,checkedAt:rotowireData.updatedAt,source:rw.source}:current;
   const name=selected?.name||l?.startingGoalie;
   const status=selected?.status||l?.startingGoalieStatus;
   const checked=selected?.checkedAt||l?.startingGoalieCheckedAt;
   const source=selected?.source||l?.startingGoalieSource;"""
if needle in html:
    html = html.replace(needle, replacement, 1)
    changes += 1

# Make the goalie center discoverable from the main navigation.
needle = '<nav class="toolbar">'
if needle in html and 'href="./goalies.html"' not in html:
    html = html.replace(needle, needle + '<a class="btn" href="./goalies.html" style="text-decoration:none">🥅 Brankáři NHL</a>', 1)
    changes += 1

if changes:
    path.write_text(html, encoding="utf-8")
print("Applied NHL goalie UI patches:", changes)
