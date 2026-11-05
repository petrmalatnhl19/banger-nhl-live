"""Apply small, idempotent goalie integration patches to the existing NHL UI."""
from pathlib import Path

path = Path(__file__).resolve().parent.parent / "index.html"
html = path.read_text(encoding="utf-8")
changes = 0

# Repair duplicate declarations from earlier scheduled runs before patching.
import re
duplicate = "let rotowireGoalies={games:[]};try{const rr=await fetch('./rotowire_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});if(rr.ok)rotowireGoalies=await rr.json()}catch(e){}"
while duplicate + duplicate in html:
    html = html.replace(duplicate + duplicate, duplicate, 1)
    changes += 1

# All lineup goalie panels should use the same verified, date-scoped source.
needle = "let startingGoalies={};try{const gr=await fetch('./starting_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});"
replacement = """let rotowireGoalies={games:[]};try{const rr=await fetch('./rotowire_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});if(rr.ok)rotowireGoalies=await rr.json()}catch(e){}let startingGoalies={};try{const gr=await fetch('./starting_goalies.json?t='+Math.floor(Date.now()/900000),{cache:'no-store'});"""
if needle in html and duplicate not in html:
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

needle = """'+narrative.join('')+'<p class="analysis-small">"""
if needle in html and "expertGoalieSection+narrative.join" not in html:
    html = html.replace(needle, """'+expertGoalieSection+narrative.join('')+'<p class="analysis-small">""", 1)
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

# Add data-backed comparative metrics to the written Expert Report, once.
metrics_anchor = " const narrative=[];"
metrics_code = """ const bangerMetrics=(row,code)=>{
  if(!row)return clean(code)+': aktuální tabulkové statistiky nejsou dostupné.';
  const n=Number(row.gamesPlayed)||0;
  if(!n)return clean(code)+': zatím není dost odehraných utkání.';
  const number=(v)=>Number.isFinite(Number(v))?Number(v):null;
  const goalsFor=number(row.goalFor),goalsAgainst=number(row.goalAgainst);
  const shotsFor=number(row.shotsForPerGame),shotsAgainst=number(row.shotsAgainstPerGame);
  const diff=goalsFor!=null&&goalsAgainst!=null?goalsFor-goalsAgainst:null;
  const points=number(row.points);
  const recent=row.l10Wins!=null&&row.l10Losses!=null?
    'Bilance posledních deseti zápasů: '+row.l10Wins+' výher, '+row.l10Losses+' porážek'+(row.l10OtLosses!=null?' a '+row.l10OtLosses+' proher po prodloužení':'')+'. ':'';
  const streak=row.streakCode&&row.streakCount?'Aktuální série: '+clean(row.streakCode)+' '+Number(row.streakCount)+'. ':'';
  return clean(code)+' má '+n+' odehraných zápasů'+(points!=null?', '+points+' bodů':'')+
   (diff!=null?' a gólový rozdíl '+(diff>0?'+':'')+diff+'. ':'. ')+
   (goalsFor!=null&&goalsAgainst!=null?'Celkem vstřelil '+goalsFor+' a inkasoval '+goalsAgainst+' gólů. ':'')+
   recent+streak;
 };
 const bangerCompare=()=>{
  if(!ar||!hr)return 'Pro srovnání tabulkové síly nejsou dostupná úplná data obou týmů.';
  const a=Number(ar.pointPctg),h=Number(hr.pointPctg);
  if(!Number.isFinite(a)||!Number.isFinite(h))return 'Bodová úspěšnost v tabulce není pro oba týmy dostupná.';
  const delta=Math.abs(a-h)*100;
  return delta<3?'Bodová úspěšnost obou týmů je podobná.':
   'Podle bodové úspěšnosti má zatím navrch '+clean(a>h?ac:hc)+' o přibližně '+delta.toFixed(1).replace('.',',')+' procentního bodu.';
 };
"""
if metrics_anchor in html and "const bangerMetrics=" not in html:
    html = html.replace(metrics_anchor, metrics_code + metrics_anchor, 1)
    changes += 1

metrics_section_anchor = " section('Celkový obraz utkání',"
metrics_section = """ section('Tabulková síla a dlouhodobá stabilita',bangerMetrics(ar,ac)+' '+bangerMetrics(hr,hc)+' '+bangerCompare()+' Jde o popis dosavadní sezony, nikoli jistotu výsledku.');
"""
if metrics_section_anchor in html and "section('Tabulková síla a dlouhodobá stabilita'" not in html:
    html = html.replace(metrics_section_anchor, metrics_section + metrics_section_anchor, 1)
    changes += 1

# Enhance the written report with verified last-game shooting and recovery context.
extra_anchor = " const narrative=[];"
extra_code = """ const bangerShotReport=(skaters,code)=>{
  if(!skaters)return clean(code)+': střelecká data posledního zápasu nejsou dostupná.';
  const attempts=Number(skaters.shots),goals=Number(skaters.goals);
  if(!Number.isFinite(attempts)||attempts<=0)return clean(code)+': počet střel v posledním utkání není ověřen.';
  return clean(code)+' v posledním dostupném zápase vyslal '+attempts+' střel na branku a skóroval '+goals+'krát. Úspěšnost zakončení byla '+fmt(100*goals/attempts)+' procenta. Jde o jediné utkání, ne o dlouhodobou střeleckou úroveň.';
 };
 const bangerRestReport=(games,code)=>{
  const played=games.filter(g=>g.gameDate&&[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(code))
   .map(g=>g.gameDate).sort().reverse();
  const unique=[...new Set(played)];
  if(!unique.length)return clean(code)+': datum posledního utkání není k dispozici.';
  const days=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(unique[0]+'T12:00:00Z'))/86400000);
  if(!Number.isFinite(days)||days<0)return clean(code)+': odpočinek nelze spolehlivě určit.';
  const between=unique.length>1?Math.round((Date.parse(unique[0]+'T12:00:00Z')-Date.parse(unique[1]+'T12:00:00Z'))/86400000):null;
  return clean(code)+' odehrál poslední dostupné utkání '+clean(unique[0])+'. Do dne zápasu uplynulo '+days+' kalendářních dní'+(days===1?', což odpovídá druhému zápasu ve dvou dnech':'.')+
   (between===1?' Také předchozí dvojice zápasů následovala ve dvou dnech.':'')+
   ' Bez informací o cestování a skutečném nasazení hráčů nejde únavu přesně kvantifikovat.';
 };
"""
if extra_anchor in html and "const bangerShotReport=" not in html:
    html = html.replace(extra_anchor, extra_code + extra_anchor, 1)
    changes += 1
section_anchor = " section('Celkový obraz utkání',"
new_sections = """ section('Střelecká aktivita a efektivita',bangerShotReport(skaters[0],ac)+' '+bangerShotReport(skaters[1],hc)+' Vyšší úspěšnost střelby z jediného utkání sama o sobě neznamená lepší útok.');
 section('Odpočinek a náročnost programu',bangerRestReport(ga,ac)+' '+bangerRestReport(gh,hc));
"""
if section_anchor in html and "section('Střelecká aktivita a efektivita'" not in html:
    html = html.replace(section_anchor, new_sections + section_anchor, 1)
    changes += 1

# Install the voice player once; it observes Expert Reports rendered dynamically.
voice_tag = '<script defer src="./expert-voice.js"></script>'
if voice_tag not in html:
    html = html.replace('</body>', voice_tag + '</body>', 1)
    changes += 1

if changes:
    path.write_text(html, encoding="utf-8")
print("Applied NHL goalie UI patches:", changes)
