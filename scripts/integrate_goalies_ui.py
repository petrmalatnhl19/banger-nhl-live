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

# Expert Report: show a date-scoped starting-goalie dashboard with source and freshness.
needle = " const projected=await projectedGoalies();"
replacement = """ const projected=await projectedGoalies();
 const expertGoalieCards=projected.map((p,i)=>{const code=i===0?ac:hc;const state=p?.status==='confirmed'?'✓ CONFIRMED':p?.status==='projected'?'◷ PROJECTED':'? UNKNOWN';const color=p?.status==='confirmed'?'#75edb3':p?.status==='projected'?'#ffce81':'#9db2c6';return '<div style="padding:14px;border:1px solid #306a8c;border-radius:13px;background:#0b1b35;flex:1;min-width:180px"><b>'+clean(code)+'</b><p style="margin:8px 0;color:'+color+'">'+state+'</p><strong>'+clean(p?.name||'Start zatím neznámý')+'</strong>'+(p?'<p class="analysis-small">Ověřeno: '+clean(new Date(p.checked).toLocaleString('cs-CZ'))+'</p><a href="'+clean(p.source)+'" target="_blank" rel="noopener noreferrer">RotoWire / zdroj ↗</a>':'<p class="analysis-small">Bez aktuálně ověřeného startu pro tento zápas.</p>')+'</div>'}).join('');
 const expertGoalieSection='<section class="analysis-section"><h3>🥅 Brankáři a sestavy · '+clean(day)+'</h3><p>Stav startu se vztahuje výhradně k tomuto zápasu. PROJECTED není potvrzení.</p><div style="display:flex;flex-wrap:wrap;gap:12px">'+expertGoalieCards+'</div><p class="analysis-small">Kompletní seznam: <a href="./goalies.html" target="_blank" rel="noopener noreferrer">BANGER GOALIE CENTER ↗</a></p></section>';"""
if needle in html and "const expertGoalieSection=" not in html:
    html = html.replace(needle, replacement, 1)
    changes += 1

needle = """'+narrative.join('')+'<p class=\\"analysis-small\\">"""
if needle in html and "expertGoalieSection+narrative.join" not in html:
    html = html.replace(needle, "'+expertGoalieSection+narrative.join('')+'<p class=\\\"analysis-small\\\">", 1)
    changes += 1

# Prevent a stale lineup projection being presented as a current starter.
needle = """const name=selected?.name||l?.startingGoalie;
   const status=selected?.status||l?.startingGoalieStatus;
   const checked=selected?.checkedAt||l?.startingGoalieCheckedAt;
   const source=selected?.source||l?.startingGoalieSource;"""
replacement = """const name=selected?.name;
   const status=selected?.status;
   const checked=selected?.checkedAt;
   const source=selected?.source;"""
if needle in html:
    html = html.replace(needle, replacement, 1)
    changes += 1

if changes:
    path.write_text(html, encoding="utf-8")
print("Applied NHL goalie UI patches:", changes)
