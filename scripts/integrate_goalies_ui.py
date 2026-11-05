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

# Compare recent form over 5/10 games and strength of faced opponents using real NHL standings.
form_anchor = " const narrative=[];"
form_code = """ const bangerRecentForm=(games,code,count)=>{
  const list=games.slice(0,count);
  if(list.length<Math.min(count,3))return null;
  let wins=0,goalsFor=0,goalsAgainst=0;
  const opponentStrength=[];
  for(const game of list){
   const own=game.homeTeam?.abbrev===code?game.homeTeam:game.awayTeam;
   const opp=game.homeTeam?.abbrev===code?game.awayTeam:game.homeTeam;
   if(!own||!opp||!Number.isFinite(Number(own.score))||!Number.isFinite(Number(opp.score)))continue;
   goalsFor+=Number(own.score);goalsAgainst+=Number(opp.score);
   if(Number(own.score)>Number(opp.score))wins++;
   const opponent=find(opp.abbrev);
   const played=Number(opponent?.gamesPlayed);
   if(played>0&&Number.isFinite(Number(opponent?.points)))opponentStrength.push(Number(opponent.points)/(2*played));
  }
  return {n:list.length,wins,goalsFor,goalsAgainst,opponentStrength};
 };
 const bangerFormText=(games,code)=>{
  const f5=bangerRecentForm(games,code,5),f10=bangerRecentForm(games,code,10);
  if(!f5)return clean(code)+': není dostatek dokončených zápasů pro porovnání formy.';
  const describe=f=>f.wins+' výher z '+f.n+' zápasů, '+fmt(f.goalsFor/f.n)+' vstřeleného a '+fmt(f.goalsAgainst/f.n)+' inkasovaného gólu na utkání';
  const opponents=f10?.opponentStrength||f5.opponentStrength;
  const difficulty=opponents.length>=3?'Průměrná bodová úspěšnost soupeřů v dostupné sezonní tabulce byla '+fmt(100*opponents.reduce((a,b)=>a+b,0)/opponents.length)+' procenta. ':'';
  return clean(code)+': posledních '+f5.n+' utkání '+describe(f5)+'. '+
   (f10&&f10.n>f5.n?'V posledních '+f10.n+' utkáních '+describe(f10)+'. ':'')+
   difficulty+'Srovnání formy má omezenou vypovídací hodnotu kvůli krátkému vzorku.';
 };
"""
if form_anchor in html and "const bangerRecentForm=" not in html:
    html = html.replace(form_anchor, form_code + form_anchor, 1)
    changes += 1
form_section_anchor = " section('Celkový obraz utkání',"
form_section = """ section('Forma za pět a deset zápasů a síla soupeřů',bangerFormText(ga,ac)+' '+bangerFormText(gh,hc)+' Výkonnost proti silnějším soupeřům může mít jinou váhu než stejné výsledky proti slabším týmům.');
"""
if form_section_anchor in html and "section('Forma za pět a deset zápasů a síla soupeřů'" not in html:
    html = html.replace(form_section_anchor, form_section + form_section_anchor, 1)
    changes += 1

# Add an honest short pregame snapshot to the narrative, using only already fetched data.
snapshot_anchor = " const narrative=[];"
snapshot_code = """ const bangerSnapshot=()=>{
  const seasonGoals=[af,aa,hf,ha].every(Number.isFinite);
  const expectedAway=seasonGoals?Math.max(.4,Math.min(6,(af+ha)/2)):null;
  const expectedHome=seasonGoals?Math.max(.4,Math.min(6,(hf+aa)/2)):null;
  const total=expectedAway!=null?expectedAway+expectedHome:null;
  const expectedGoals=total!=null?'Zjednodušený sezonní model očekává přibližně '+fmt(total)+' gólu celkem, z toho '+fmt(expectedAway)+' pro '+clean(ac)+' a '+fmt(expectedHome)+' pro '+clean(hc)+'.':'Odhad počtu gólů zatím není dostupný.';
  const favorite=expectedAway==null?'Favorita zatím nelze určit.':Math.abs(expectedAway-expectedHome)<.35?'Gólové profily naznačují vyrovnaný zápas.':'Gólové profily mírně zvýhodňují '+clean(expectedAway>expectedHome?ac:hc)+'.';
  const a=skaters[0],h=skaters[1];
  const shots=a?.shots>0&&h?.shots>0?'V posledním dostupném utkání zaznamenal '+clean(ac)+' '+a.shots+' střel hráčů na branku a '+clean(hc)+' '+h.shots+'. Jde o minulý výkon, nikoli predikci počtu střel.':'Pro spolehlivou predikci počtu střel chybí sezonní střelecké průměry obou týmů.';
  const physical=a&&h&&Number.isFinite(a.hits)&&Number.isFinite(h.hits)?'V posledním dostupném utkání zaznamenal '+clean(ac)+' '+a.hits+' hitů a '+clean(hc)+' '+h.hits+' hitů. Z jednoho utkání nelze určit, zda příští zápas bude tvrdý.':'Tvrdost zápasu zatím nelze spolehlivě odhadnout bez dlouhodobých statistik hitů a trestů.';
  const direct=h2h.filter(g=>[g.homeTeam?.abbrev,g.awayTeam?.abbrev].includes(ac)&&[g.homeTeam?.abbrev,g.awayTeam?.abbrev].includes(hc));
  const rivalry=direct.length?'V dostupné historii je '+direct.length+' posledních vzájemných utkání. Jejich výsledky samy o sobě nedokazují rivalitu ani zvýšenou tvrdost zápasu.':'Vzájemná historie v dostupném vzorku chybí; rivalitu nelze z dat potvrdit.';
  return expectedGoals+' '+favorite+' '+shots+' '+physical+' '+rivalry;
 };
"""
if snapshot_anchor in html and "const bangerSnapshot=" not in html:
    html = html.replace(snapshot_anchor, snapshot_code + snapshot_anchor, 1)
    changes += 1
snapshot_section_anchor = " section('Tabulková síla a dlouhodobá stabilita',"
snapshot_section = """ section('Rychlá předzápasová predikce',bangerSnapshot());
"""
if snapshot_section_anchor in html and "section('Rychlá předzápasová predikce'" not in html:
    html = html.replace(snapshot_section_anchor, snapshot_section + snapshot_section_anchor, 1)
    changes += 1

# Add explicitly model-based total-goal probabilities and observed head-to-head scoring.
prob_anchor = "  const expectedGoals=total!=null?"
prob_code = """  const poissonTail=(lambda,threshold)=>{
   let probability=0,term=Math.exp(-lambda);
   for(let n=0;n<threshold;n++){probability+=term;term*=lambda/(n+1)}
   return Math.max(0,Math.min(1,1-probability));
  };
  const goalChances=total!=null?
   'Podle nezávislého Poissonova modelu je pravděpodobnost alespoň pěti gólů '+fmt(100*poissonTail(total,5))+' procent a alespoň šesti gólů '+fmt(100*poissonTail(total,6))+' procent. Jde o nekalibrované modelové odhady, nikoli jistotu. ':'';
"""
if prob_anchor in html and "const goalChances=" not in html:
    html = html.replace(prob_anchor,prob_code+prob_anchor,1)
    changes += 1
h2h_anchor = "  const rivalry=direct.length?"
h2h_code = """  const meetings=direct.filter(g=>Number.isFinite(Number(g.homeTeam?.score))&&Number.isFinite(Number(g.awayTeam?.score)));
  const meetingStats=meetings.length>=2?
   'V posledních '+meetings.length+' dostupných vzájemných zápasech padlo průměrně '+
   fmt(meetings.reduce((sum,g)=>sum+Number(g.homeTeam.score)+Number(g.awayTeam.score),0)/meetings.length)+
   ' gólu na utkání. Malý vzorek nemusí předpovídat příští výsledek. ':'';
"""
if h2h_anchor in html and "const meetingStats=" not in html:
    html = html.replace(h2h_anchor,h2h_code+h2h_anchor,1)
    changes += 1
return_anchor = "  return expectedGoals+' '+favorite+' '+shots+' '+physical+' '+rivalry;"
if return_anchor in html:
    html=html.replace(return_anchor,"  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+meetingStats+rivalry;",1)
    changes+=1

# Extend existing last-game boxscore fetch with a five-game sample for each club.
sample_anchor = " const skaterSection='<details class="
sample_code = """ const bangerSampleGames=async(games,code)=>{
  const ids=games.slice(0,5).map(g=>g.id).filter(Boolean);
  const results=await Promise.all(ids.map(id=>safe(()=>get('https://api-web.nhle.com/v1/gamecenter/'+encodeURIComponent(id)+'/boxscore'),3500)));
  const records=results.map(r=>skaterSummary(r,code)).filter(Boolean);
  if(records.length<3)return null;
  const sum=key=>records.reduce((n,r)=>n+r[key],0);
  return {n:records.length,shots:sum('shots')/records.length,hits:sum('hits')/records.length,blocks:sum('blocks')/records.length};
 };
 const bangerSamples=await Promise.all([bangerSampleGames(ga,ac),bangerSampleGames(gh,hc)]);
 if(!root.isConnected)return;
"""
if sample_anchor in html and "const bangerSampleGames=" not in html:
    html = html.replace(sample_anchor,sample_code+sample_anchor,1)
    changes += 1
sample_report_anchor = " const narrative=[];"
sample_report_code = """ const bangerSampleText=(sample,code)=>sample?
  clean(code)+': za '+sample.n+' posledních dostupných utkání průměrně '+fmt(sample.shots)+' střel na branku, '+fmt(sample.hits)+' hitů a '+fmt(sample.blocks)+' bloků na zápas. ':
  clean(code)+': není dost dostupných boxscore pro vícezápasový vzorek. ';
"""
if sample_report_anchor in html and "const bangerSampleText=" not in html:
    html = html.replace(sample_report_anchor,sample_report_code+sample_report_anchor,1)
    changes += 1
sample_section_anchor = " section('Celkový obraz utkání',"
sample_section = """ section('Střely, hity a bloky z posledních utkání',bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' Jde o průměry malého vzorku, ne o potvrzenou předpověď příštího utkání.');
"""
if sample_section_anchor in html and "section('Střely, hity a bloky z posledních utkání'" not in html:
    html = html.replace(sample_section_anchor,sample_section+sample_section_anchor,1)
    changes += 1
# Include five-game context in the short snapshot without inventing probability percentages.
snapshot_return = "  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+meetingStats+rivalry;"
if snapshot_return in html:
    html = html.replace(snapshot_return,"  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+meetingStats+rivalry;",1)
    changes += 1

# Include penalty minutes from real boxscores and describe physical intensity conservatively.
penalty_old = "  const blocks=skaters.reduce((sum,p)=>sum+numeric(p.blockedShots??p.blocks),0);"
penalty_new = """  const blocks=skaters.reduce((sum,p)=>sum+numeric(p.blockedShots??p.blocks),0);
  const penaltyMinutes=skaters.reduce((sum,p)=>sum+numeric(p.pim??p.penaltyMinutes),0);"""
if penalty_old in html and "const penaltyMinutes=skaters.reduce" not in html:
    html=html.replace(penalty_old,penalty_new,1)
    changes+=1
skater_return_old = "return {leaders,shots,goals,hits,blocks,date:data.gameDate||null};"
skater_return_new = "return {leaders,shots,goals,hits,blocks,penaltyMinutes,date:data.gameDate||null};"
if skater_return_old in html:
    html=html.replace(skater_return_old,skater_return_new,1)
    changes+=1
sample_return_old = "return {n:records.length,shots:sum('shots')/records.length,hits:sum('hits')/records.length,blocks:sum('blocks')/records.length};"
sample_return_new = "return {n:records.length,shots:sum('shots')/records.length,hits:sum('hits')/records.length,blocks:sum('blocks')/records.length,penaltyMinutes:sum('penaltyMinutes')/records.length};"
if sample_return_old in html:
    html=html.replace(sample_return_old,sample_return_new,1)
    changes+=1
sample_text_old = "fmt(sample.blocks)+' bloků na zápas. ':"
sample_text_new = "fmt(sample.blocks)+' bloků a '+fmt(sample.penaltyMinutes)+' trestných minut hráčů na zápas. ':"
if sample_text_old in html:
    html=html.replace(sample_text_old,sample_text_new,1)
    changes+=1
physical_anchor = " const narrative=[];"
physical_code = """ const bangerPhysicalOutlook=()=>{
  const a=bangerSamples[0],h=bangerSamples[1];
  if(!a||!h)return 'Pro hodnocení fyzické náročnosti chybí dostatek nedávných zápasů obou týmů.';
  const hits=a.hits+h.hits;
  const minutes=a.penaltyMinutes+h.penaltyMinutes;
  return 'Oba týmy v posledních dostupných zápasech dohromady zaznamenávaly v průměru '+
   fmt(hits)+' hitů a '+fmt(minutes)+' trestných minut hráčů na dva týmové zápasy. '+
   'To popisuje jejich nedávný herní styl, nikoli předpověď konkrétního počtu hitů nebo vyloučení. '+
   'Hity a trestné minuty nejsou samy o sobě důkazem rivality.';
 };
"""
if physical_anchor in html and "const bangerPhysicalOutlook=" not in html:
    html=html.replace(physical_anchor,physical_code+physical_anchor,1)
    changes+=1
physical_section_anchor = " section('Celkový obraz utkání',"
physical_section = """ section('Fyzická náročnost a trestné minuty',bangerPhysicalOutlook());
"""
if physical_section_anchor in html and "section('Fyzická náročnost a trestné minuty'" not in html:
    html=html.replace(physical_section_anchor,physical_section+physical_section_anchor,1)
    changes+=1
snapshot_return = "  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+meetingStats+rivalry;"
if snapshot_return in html:
    html=html.replace(snapshot_return,"  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+bangerPhysicalOutlook()+' '+meetingStats+rivalry;",1)
    changes+=1

# Sample actual goalie boxscore data from the same recent games (not projected starters).
goalie_sample_anchor = " const skaterSection='<details class="
goalie_sample_code = """ const bangerGoalieSample=async(games,code)=>{
  const ids=games.slice(0,5).map(g=>g.id).filter(Boolean);
  const results=await Promise.all(ids.map(id=>safe(()=>get('https://api-web.nhle.com/v1/gamecenter/'+encodeURIComponent(id)+'/boxscore'),3500)));
  let saves=0,shots=0,starts=0;
  for(const result of results){
   if(!result.ok||!result.data)continue;
   const data=result.data;
   const side=data.awayTeam?.abbrev===code?'awayTeam':data.homeTeam?.abbrev===code?'homeTeam':null;
   const goalies=side?data.playerByGameStats?.[side]?.goalies:null;
   if(!Array.isArray(goalies))continue;
   const starter=goalies.find(g=>g.starter)||goalies[0];
   const match=String(starter?.saveShotsAgainst||'').match(/(\d+)\s*\/\s*(\d+)/);
   if(!match||Number(match[2])<=0)continue;
   saves+=Number(match[1]);shots+=Number(match[2]);starts++;
  }
  return starts>=3&&shots>0?{starts,saves,shots,pct:100*saves/shots}:null;
 };
 const bangerGoalieSamples=await Promise.all([bangerGoalieSample(ga,ac),bangerGoalieSample(gh,hc)]);
 if(!root.isConnected)return;
"""
if goalie_sample_anchor in html and "const bangerGoalieSample=" not in html:
    html=html.replace(goalie_sample_anchor,goalie_sample_code+goalie_sample_anchor,1)
    changes+=1
goalie_text_anchor = " const narrative=[];"
goalie_text_code = """ const bangerGoalieText=(sample,code)=>sample?
  'Brankáři, kteří nastoupili od začátku za '+clean(code)+', měli v '+sample.starts+' posledních dostupných utkáních souhrnnou úspěšnost zákroků '+fmt(sample.pct)+' procent ('+sample.saves+' z '+sample.shots+' střel). ':
  'Pro '+clean(code)+' není dost údajů o zákrocích brankářů v posledních zápasech. ';
"""
if goalie_text_anchor in html and "const bangerGoalieText=" not in html:
    html=html.replace(goalie_text_anchor,goalie_text_code+goalie_text_anchor,1)
    changes+=1
goalie_section_anchor = " section('Celkový obraz utkání',"
goalie_section = """ section('Aktuální výkonnost brankářů',bangerGoalieText(bangerGoalieSamples[0],ac)+bangerGoalieText(bangerGoalieSamples[1],hc)+' Statistiky se vztahují ke skutečně nasazeným brankářům v minulých zápasech, nikoli k potvrzenému startérovi příštího utkání.');
"""
if goalie_section_anchor in html and "section('Aktuální výkonnost brankářů'" not in html:
    html=html.replace(goalie_section_anchor,goalie_section+goalie_section_anchor,1)
    changes+=1
snapshot_return = "  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+bangerPhysicalOutlook()+' '+meetingStats+rivalry;"
if snapshot_return in html:
    html=html.replace(snapshot_return,"  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+bangerGoalieText(bangerGoalieSamples[0],ac)+bangerGoalieText(bangerGoalieSamples[1],hc)+' '+bangerPhysicalOutlook()+' '+meetingStats+rivalry;",1)
    changes+=1

# Special teams: read actual power-play conversion fractions from NHL game landing summaries.
special_anchor = " const skaterSection='<details class="
special_code = """ const bangerSpecialTeams=async(games,code)=>{
  const ids=games.slice(0,5).map(g=>g.id).filter(Boolean);
  const results=await Promise.all(ids.map(id=>safe(()=>get('https://api-web.nhle.com/v1/gamecenter/'+encodeURIComponent(id)+'/landing'),3500)));
  let ppGoals=0,ppChances=0,pkAllowed=0,pkFaced=0,n=0;
  const fraction=v=>{
   const m=String(v??'').match(/(\\\\d+)\\\\s*\\\\/\\\\s*(\\\\d+)/);
   return m?[Number(m[1]),Number(m[2])]:null;
  };
  for(const result of results){
   if(!result.ok||!result.data)continue;
   const data=result.data;
   const side=data.awayTeam?.abbrev===code?'away':'home';
   const other=side==='away'?'home':'away';
   if(data[side+'Team']?.abbrev!==code)continue;
   const rows=data.summary?.teamGameStats;
   if(!Array.isArray(rows))continue;
   const row=rows.find(x=>/power.?play/i.test(String(x.category||x.name||'')));
   if(!row)continue;
   const own=fraction(row[side+'Value']??row[side+'Team']);
   const opp=fraction(row[other+'Value']??row[other+'Team']);
   if(!own||!opp||own[1]<0||opp[1]<0)continue;
   ppGoals+=own[0];ppChances+=own[1];pkAllowed+=opp[0];pkFaced+=opp[1];n++;
  }
  return n>=3?{n,ppGoals,ppChances,pkAllowed,pkFaced,ppPct:ppChances>0?100*ppGoals/ppChances:null,pkPct:pkFaced>0?100*(pkFaced-pkAllowed)/pkFaced:null}:null;
 };
 const bangerSpecial=await Promise.all([bangerSpecialTeams(ga,ac),bangerSpecialTeams(gh,hc)]);
 if(!root.isConnected)return;
"""
if special_anchor in html and "const bangerSpecialTeams=" not in html:
    html=html.replace(special_anchor,special_code+special_anchor,1)
    changes+=1
special_text_anchor = " const narrative=[];"
special_text_code = """ const bangerSpecialText=(sample,code)=>{
  if(!sample)return clean(code)+': nedostatek ověřených údajů o přesilovkách a oslabeních v posledních zápasech. ';
  return clean(code)+': za '+sample.n+' dostupných utkání přesilovky '+
   (sample.ppPct==null?'bez dostatku příležitostí':fmt(sample.ppPct)+' procent ('+sample.ppGoals+' z '+sample.ppChances+')')+
   ', oslabení '+(sample.pkPct==null?'bez dostatku příležitostí':fmt(sample.pkPct)+' procent ('+(sample.pkFaced-sample.pkAllowed)+' ubráněných z '+sample.pkFaced+')')+'. ';
 };
"""
if special_text_anchor in html and "const bangerSpecialText=" not in html:
    html=html.replace(special_text_anchor,special_text_code+special_text_anchor,1)
    changes+=1
special_section_anchor = " section('Celkový obraz utkání',"
special_section = """ section('Přesilovky a oslabení',bangerSpecialText(bangerSpecial[0],ac)+bangerSpecialText(bangerSpecial[1],hc)+' Hodnoty vycházejí z malého vzorku dokončených zápasů, nikoli ze sezonních souhrnů. Příští počet vyloučení není znám.');
"""
if special_section_anchor in html and "section('Přesilovky a oslabení'" not in html:
    html=html.replace(special_section_anchor,special_section+special_section_anchor,1)
    changes+=1
snapshot_return = "  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+bangerGoalieText(bangerGoalieSamples[0],ac)+bangerGoalieText(bangerGoalieSamples[1],hc)+' '+bangerPhysicalOutlook()+' '+meetingStats+rivalry;"
if snapshot_return in html:
    html=html.replace(snapshot_return,"  return expectedGoals+' '+goalChances+favorite+' '+shots+' '+physical+' '+bangerSampleText(bangerSamples[0],ac)+bangerSampleText(bangerSamples[1],hc)+' '+bangerGoalieText(bangerGoalieSamples[0],ac)+bangerGoalieText(bangerGoalieSamples[1],hc)+' '+bangerSpecialText(bangerSpecial[0],ac)+bangerSpecialText(bangerSpecial[1],hc)+' '+bangerPhysicalOutlook()+' '+meetingStats+rivalry;",1)
    changes+=1

# Normalize escaped regex emitted by the earlier Python string template.
bad_fraction = r"/(\\d+)\\s*\\/\\s*(\\d+)/"
good_fraction = r"/(\d+)\s*\/\s*(\d+)/"
if bad_fraction in html:
    html = html.replace(bad_fraction, good_fraction)
    changes += 1

# NHL teamGameStats live in gamecenter/right-rail; landing is not reliable for these fields.
right_rail_old = "'/landing'),3500)));\\n  let ppGoals=0"
right_rail_new = "'/right-rail'),3500)));\\n  let ppGoals=0"
# Target only the special-teams helper, never other landing calls.
start = html.find(" const bangerSpecialTeams=async(")
end = html.find(" const bangerSpecial=await", start)
if start >= 0 and end > start:
    block = html[start:end]
    revised = block.replace("+'/landing'),3500)", "+'/right-rail'),3500)")
    revised = revised.replace("const rows=data.summary?.teamGameStats;", "const rows=data.teamGameStats??data.summary?.teamGameStats;")
    if revised != block:
        html = html[:start] + revised + html[end:]
        changes += 1

# Right-rail responses need not repeat home/away team identities; use the schedule game.
side_start = html.find(" const bangerSpecialTeams=async(")
side_end = html.find(" const bangerSpecial=await", side_start)
if side_start >= 0 and side_end > side_start:
    block = html[side_start:side_end]
    revised = block.replace(
        "const results=await Promise.all(ids.map(id=>safe(()=>get('https://api-web.nhle.com/v1/gamecenter/'+encodeURIComponent(id)+'/right-rail'),3500)));",
        "const results=await Promise.all(ids.map(id=>safe(()=>get('https://api-web.nhle.com/v1/gamecenter/'+encodeURIComponent(id)+'/right-rail'),3500)));"
    )
    revised = revised.replace(
        "  for(const result of results){",
        "  for(let index=0;index<results.length;index++){\\n   const result=results[index];\\n   const game=games.find(g=>String(g.id)===String(ids[index]));"
    )
    revised = revised.replace(
        "const side=data.awayTeam?.abbrev===code?'away':'home';",
        "const side=game?.awayTeam?.abbrev===code?'away':game?.homeTeam?.abbrev===code?'home':null;"
    )
    revised = revised.replace(
        "if(data[side+'Team']?.abbrev!==code)continue;",
        "if(!side)continue;"
    )
    if revised != block:
        html = html[:side_start] + revised + html[side_end:]
        changes += 1

# Replace accidental literal backslash-n sequences introduced in the PP/PK loop.
special_start = html.find(" const bangerSpecialTeams=async(")
special_end = html.find(" const bangerSpecial=await", special_start)
if special_start >= 0 and special_end > special_start:
    special_block = html[special_start:special_end]
    fixed_block = special_block.replace(r"{\n   const result=", "{\n   const result=").replace(r";\n   const game=", ";\n   const game=")
    if fixed_block != special_block:
        html = html[:special_start] + fixed_block + html[special_end:]
        changes += 1

# Concise expert verdict, with explicit data coverage and uncertainty.
verdict_anchor = " const narrative=[];"
verdict_code = """ const bangerVerdict=()=>{
  const complete=[af,aa,hf,ha].every(Number.isFinite);
  const away=complete?Math.max(.4,Math.min(6,(af+ha)/2)):null;
  const home=complete?Math.max(.4,Math.min(6,(hf+aa)/2)):null;
  const total=away==null?null:away+home;
  const shots=bangerSamples;
  const goalies=bangerGoalieSamples;
  const special=bangerSpecial;
  const covered=[complete,!!shots[0],!!shots[1],!!goalies[0],!!goalies[1],!!special[0],!!special[1]];
  const coverage=covered.filter(Boolean).length;
  const confidence=coverage>=7?'vyšší pokrytí dat':coverage>=4?'střední pokrytí dat':'omezené pokrytí dat';
  const lines=[];
  lines.push('Góly: '+(total==null?'nedostatek sezonních údajů':fmt(total)+' očekávaných celkem (zjednodušený sezonní model; '+clean(ac)+' '+fmt(away)+', '+clean(hc)+' '+fmt(home)+')')+'.');
  lines.push('Průběh: '+(total==null?'bez jasného favorita podle gólových průměrů':Math.abs(away-home)<.35?'vyrovnaný podle gólových profilů':'mírná modelová výhoda '+clean(away>home?ac:hc))+'.');
  lines.push('Střely: '+(shots[0]&&shots[1]?clean(ac)+' '+fmt(shots[0].shots)+', '+clean(hc)+' '+fmt(shots[1].shots)+' na zápas v posledních '+shots[0].n+' a '+shots[1].n+' utkáních':'nedostatek srovnatelných posledních utkání')+'.');
  lines.push('Fyzická hra: '+(shots[0]&&shots[1]?fmt(shots[0].hits+shots[1].hits)+' hitů obou týmů v součtu jejich průměrů; tvrdost příštího zápasu není jistá':'nedostatek údajů o hitech')+'.');
  lines.push('Brankáři: '+(goalies[0]&&goalies[1]?clean(ac)+' '+fmt(goalies[0].pct)+' %, '+clean(hc)+' '+fmt(goalies[1].pct)+' % zákroků v nedávných startech':'chybí srovnatelná forma brankářů')+'.');
  lines.push('Speciální týmy: '+(special[0]&&special[1]?clean(ac)+' PP '+(special[0].ppPct==null?'bez dat':fmt(special[0].ppPct)+' %')+', '+clean(hc)+' PP '+(special[1].ppPct==null?'bez dat':fmt(special[1].ppPct)+' %'):'neúplná data o přesilovkách')+'.');
  lines.push('Spolehlivost: '+confidence+' ('+coverage+'/7 dostupných datových oblastí). Nejde o statisticky kalibrovanou pravděpodobnost správné předpovědi; rivalitu ani výsledek nelze z těchto čísel potvrdit.');
  return lines.join(' ');
 };
"""
if verdict_anchor in html and "const bangerVerdict=()=>{" not in html:
    html=html.replace(verdict_anchor,verdict_code+verdict_anchor,1)
    changes+=1
old_verdict=" section('Rychlá předzápasová predikce',bangerSnapshot());"
new_verdict=" section('Závěrečný expertní verdikt',bangerVerdict());"
if old_verdict in html:
    html=html.replace(old_verdict,new_verdict,1)
    changes+=1

# H2H: merge the teams' season schedules and show real scorelines, not only a count.
h2h_old = " const h2h=ga.filter(g=>[g.awayTeam.abbrev,g.homeTeam.abbrev].includes(hc)).slice(0,5);"
h2h_new = """ const h2h=unique([...ga,...gh]).filter(g=>[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(ac)&&[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(hc)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,10);"""
if h2h_old in html:
    html=html.replace(h2h_old,h2h_new,1)
    changes+=1

h2h_report_anchor = " const narrative=[];"
h2h_report_code = """ const bangerH2HReport=()=>{
  const games=h2h.filter(g=>Number.isFinite(Number(g.homeTeam?.score))&&Number.isFinite(Number(g.awayTeam?.score)));
  if(!games.length)return 'V dostupných sezonních rozpisech nejsou nalezena dokončená vzájemná utkání. Neznamená to, že týmy spolu nikdy nehrály.';
  const aw=games.filter(g=>(g.awayTeam.abbrev===ac?Number(g.awayTeam.score)>Number(g.homeTeam.score):Number(g.homeTeam.score)>Number(g.awayTeam.score))).length;
  const hw=games.length-aw;
  const avg=games.reduce((sum,g)=>sum+Number(g.homeTeam.score)+Number(g.awayTeam.score),0)/games.length;
  const results=games.slice(0,5).map(g=>clean(g.gameDate)+': '+clean(g.awayTeam.abbrev)+' '+Number(g.awayTeam.score)+' : '+Number(g.homeTeam.score)+' '+clean(g.homeTeam.abbrev)).join('; ');
  return 'Posledních '+games.length+' dostupných vzájemných zápasů: '+clean(ac)+' '+aw+' výher, '+clean(hc)+' '+hw+' výher. Průměr '+fmt(avg)+' gólu na utkání. Výsledky (hosté : domácí): '+results+'. '+(games.length<3?'Velmi malý vzorek. ':'')+'Historické výsledky samy o sobě nedokazují rivalitu ani neurčují výsledek dalšího utkání.';
 };
"""
if h2h_report_anchor in html and "const bangerH2HReport=()=>{" not in html:
    html=html.replace(h2h_report_anchor,h2h_report_code+h2h_report_anchor,1)
    changes+=1
h2h_section_anchor = " section('Tabulková síla a dlouhodobá stabilita',"
if h2h_section_anchor in html and "section('Vzájemné zápasy'," not in html:
    html=html.replace(h2h_section_anchor," section('Vzájemné zápasy',bangerH2HReport());\n"+h2h_section_anchor,1)
    changes+=1
# Eliminate accidental duplicate verdict and make the history visible in the short verdict.
duplicate_verdict = " section('Závěrečný expertní verdikt',bangerVerdict());\n section('Závěrečný expertní verdikt',bangerVerdict());"
if duplicate_verdict in html:
    html=html.replace(duplicate_verdict," section('Závěrečný expertní verdikt',bangerVerdict());",1)
    changes+=1
verdict_last = "  lines.push('Spolehlivost: '+confidence"
if verdict_last in html and "lines.push('Vzájemné zápasy: '" not in html:
    html=html.replace(verdict_last,"  lines.push('Vzájemné zápasy: '+(h2h.length?h2h.length+' dostupných utkání, podrobné výsledky v samostatné sekci':'v dostupném vzorku nejsou')+'.');\n"+verdict_last,1)
    changes+=1

# Deduplicate verdict sections even if previous runs inserted them apart.
verdict_line = " section('Závěrečný expertní verdikt',bangerVerdict());"
if html.count(verdict_line) > 1:
    first = html.find(verdict_line)
    before, after = html[:first+len(verdict_line)], html[first+len(verdict_line):]
    html = before + after.replace(verdict_line, "")
    changes += 1

# Historical head-to-head: current season plus four earlier seasons, without contaminating recent form.
history_old = " const h2h=unique([...ga,...gh]).filter(g=>[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(ac)&&[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(hc)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,10);"
history_new = """ let h2h=unique([...ga,...gh]).filter(g=>[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(ac)&&[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(hc)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,10);
 // Four earlier regular seasons; season history is descriptive, not an input to the goal model.
 const firstYear=Number(season.slice(0,4));
 if(Number.isInteger(firstYear)&&firstYear>=2010&&firstYear<=2100){
  const olderSeasons=Array.from({length:4},(_,i)=>{const y=firstYear-i-1;return String(y)+String(y+1)});
  const historyResults=await Promise.all(olderSeasons.map(y=>safe(()=>get('https://api-web.nhle.com/v1/club-schedule-season/'+encodeURIComponent(ac)+'/'+y),4000)));
  const historical=[];
  for(let i=0;i<historyResults.length;i++){
   const res=historyResults[i];
   if(!res.ok||!Array.isArray(res.data?.games))continue;
   historical.push(...res.data.games.filter(g=>g.gameDate<day&&['OFF','FINAL'].includes(g.gameState)&&g.homeTeam?.score!=null&&g.awayTeam?.score!=null).map(g=>({...g,bangerSeason:olderSeasons[i]})));
  }
  h2h=unique([...h2h,...historical]).filter(g=>[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(ac)&&[g.awayTeam?.abbrev,g.homeTeam?.abbrev].includes(hc)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,25);
 }
 if(!root.isConnected)return;"""
if history_old in html:
    html=html.replace(history_old,history_new,1)
    changes+=1

old_h2h_report = "  return 'Posledních '+games.length+' dostupných vzájemných zápasů: '+clean(ac)+' '+aw+' výher, '+clean(hc)+' '+hw+' výher. Průměr '+fmt(avg)+' gólu na utkání. Výsledky (hosté : domácí): '+results+'. '+(games.length<3?'Velmi malý vzorek. ':'')+'Historické výsledky samy o sobě nedokazují rivalitu ani neurčují výsledek dalšího utkání.';"
new_h2h_report = """  const homeWins=games.filter(g=>g.homeTeam.abbrev===hc&&Number(g.homeTeam.score)>Number(g.awayTeam.score)).length;
  const homeGames=games.filter(g=>g.homeTeam.abbrev===hc).length;
  const seasons=[...new Set(games.map(g=>String(g.bangerSeason||g.season||((Number(g.gameDate.slice(5,7))>=9?Number(g.gameDate.slice(0,4)):Number(g.gameDate.slice(0,4))-1))+'-'+(Number(g.gameDate.slice(5,7))>=9?Number(g.gameDate.slice(0,4))+1:Number(g.gameDate.slice(0,4)))))))];
  const bySeason=seasons.map(y=>{const list=games.filter(g=>String(g.bangerSeason||g.season||((Number(g.gameDate.slice(5,7))>=9?Number(g.gameDate.slice(0,4)):Number(g.gameDate.slice(0,4))-1))+'-'+(Number(g.gameDate.slice(5,7))>=9?Number(g.gameDate.slice(0,4))+1:Number(g.gameDate.slice(0,4)))))===y);return y+': '+list.length+' utkání'}).join('; ');
  return 'Posledních '+games.length+' dostupných vzájemných zápasů: '+clean(ac)+' '+aw+' výher, '+clean(hc)+' '+hw+' výher. Průměr '+fmt(avg)+' gólu na utkání. '+clean(hc)+' doma: '+homeWins+' výher z '+homeGames+' vzájemných utkání. Historie podle sezon: '+bySeason+'. Výsledky (hosté : domácí): '+results+'. '+(games.length<3?'Velmi malý vzorek. ':'')+'Starší sezony mají pro současnou formu omezenou vypovídací hodnotu; tato historie zatím nemění gólový model.';"""
if old_h2h_report in html:
    html=html.replace(old_h2h_report,new_h2h_report,1)
    changes+=1

# Conservative weighted forecast: season baseline + recent form, with bounded situational adjustments.
weighted_anchor = " const bangerVerdict=()=>{"
weighted_code = """ const bangerWeightedForecast=()=>{
  if(![af,aa,hf,ha].every(Number.isFinite))return null;
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const recentA=bangerRecentForm(ga,ac,5),recentH=bangerRecentForm(gh,hc,5);
  const baselineA=clamp((af+ha)/2,.4,6),baselineH=clamp((hf+aa)/2,.4,6);
  let away=baselineA,home=baselineH;
  const factors=['sezonní góly a inkasované branky'];
  if(recentA&&recentH){
   const recentAway=clamp((recentA.goalsFor/recentA.n+recentH.goalsAgainst/recentH.n)/2,.4,6);
   const recentHome=clamp((recentH.goalsFor/recentH.n+recentA.goalsAgainst/recentA.n)/2,.4,6);
   away=.8*away+.2*recentAway;home=.8*home+.2*recentHome;
   factors.push('forma posledních pěti utkání (20 %)');
  }
  // Mild home-ice factor, not a claim of a calibrated empirical advantage.
  away*=.985;home*=1.015;
  factors.push('malá výhoda domácího prostředí (±1,5 %)');
  if(bangerGoalieSamples[0]&&bangerGoalieSamples[1]){
   // A higher recent save percentage of opposing goalies slightly lowers expected goals.
   away*=clamp(1+(90-bangerGoalieSamples[1].pct)*.006,.96,1.04);
   home*=clamp(1+(90-bangerGoalieSamples[0].pct)*.006,.96,1.04);
   factors.push('nedávná úspěšnost brankářů (nejvýše ±4 %)');
  }
  if(bangerSpecial[0]&&bangerSpecial[1]){
   const a=bangerSpecial[0],h=bangerSpecial[1];
   if(a.ppPct!=null&&h.pkPct!=null)away*=clamp(1+(a.ppPct-(100-h.pkPct))*.001,.97,1.03);
   if(h.ppPct!=null&&a.pkPct!=null)home*=clamp(1+(h.ppPct-(100-a.pkPct))*.001,.97,1.03);
   factors.push('přesilovky a oslabení (nejvýše ±3 %)');
  }
  // Recent H2H is descriptive only: older rosters are not predictive evidence.
  return {away:clamp(away,.4,6),home:clamp(home,.4,6),factors,form:!!(recentA&&recentH)};
 };
"""
if weighted_anchor in html and "const bangerWeightedForecast=()=>{" not in html:
    html=html.replace(weighted_anchor,weighted_code+weighted_anchor,1)
    changes+=1
old_verdict_goal = "  const away=complete?Math.max(.4,Math.min(6,(af+ha)/2)):null;\n  const home=complete?Math.max(.4,Math.min(6,(hf+aa)/2)):null;"
new_verdict_goal = "  const weighted=bangerWeightedForecast();\n  const away=weighted?.away??null;\n  const home=weighted?.home??null;"
if old_verdict_goal in html:
    html=html.replace(old_verdict_goal,new_verdict_goal,1)
    changes+=1
old_verdict_label = "fmt(total)+' očekávaných celkem (zjednodušený sezonní model; '"
if old_verdict_label in html:
    html=html.replace(old_verdict_label,"fmt(total)+' očekávaných celkem (vážený orientační model; '",1)
    changes+=1
weighted_section_anchor = " section('Vzájemné zápasy',bangerH2HReport());"
weighted_section = """ section('Vážený predikční model',(()=>{
  const m=bangerWeightedForecast();
  if(!m)return 'Pro vážený model chybí úplné sezonní gólové průměry.';
  return 'Orientační očekávání: '+clean(ac)+' '+fmt(m.away)+' gólu, '+clean(hc)+' '+fmt(m.home)+' gólu, dohromady '+fmt(m.away+m.home)+'. Zohledněno: '+m.factors.join(', ')+'. Historické vzájemné zápasy zůstávají popisným kontextem, nikoli automatickou úpravou skóre. Koeficienty jsou konzervativní návrhové váhy, zatím bez zpětné kalibrace na výsledcích; nejde o garantovanou přesnost.';
 })());
"""
if weighted_section_anchor in html and "section('Vážený predikční model'," not in html:
    html=html.replace(weighted_section_anchor,weighted_section+weighted_section_anchor,1)
    changes+=1

# Install the voice player once; it observes Expert Reports rendered dynamically.
voice_tag = '<script defer src="./expert-voice.js"></script>'
if voice_tag not in html:
    html = html.replace('</body>', voice_tag + '</body>', 1)
    changes += 1

if changes:
    path.write_text(html, encoding="utf-8")
print("Applied NHL goalie UI patches:", changes)
