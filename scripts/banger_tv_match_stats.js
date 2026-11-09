/* BANGER TV MATCH STATS — read-only; never modifies CORE predictions. */
(()=>{'use strict';
const base='https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G'};
const fmt=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2});
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function fetchRows(q){const r=await fetch(base+q,{headers});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}

async function nhl(path){const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),7000);try{const r=await fetch('https://api-web.nhle.com/v1/'+path,{signal:ctrl.signal});if(!r.ok)throw Error('NHL '+r.status);return await r.json();}finally{clearTimeout(timer);}}
function skaterStats(data,team){
 const side=data.awayTeam?.abbrev===team?'awayTeam':data.homeTeam?.abbrev===team?'homeTeam':null;
 const group=side&&data.playerByGameStats?.[side];if(!group)return null;
 const players=['forwards','defense'].flatMap(k=>Array.isArray(group[k])?group[k]:[]);
 if(!players.length)return null;
 const sum=(...names)=>players.reduce((total,p)=>{const key=names.find(k=>p[k]!=null);const n=Number(key?p[key]:NaN);return total+(Number.isFinite(n)?n:0);},0);
 return {shots:sum('sog','shots'),hits:sum('hits'),blocks:sum('blockedShots','blocks'),pim:sum('pim','penaltyMinutes')};
}
function goalieStats(data,team){
 const side=data.awayTeam?.abbrev===team?'awayTeam':data.homeTeam?.abbrev===team?'homeTeam':null;
 const list=side&&data.playerByGameStats?.[side]?.goalies;
 if(!Array.isArray(list))return null;
 const g=list.find(x=>x.starter===true||x.starter==='Y'||x.starter===1);if(!g)return null;
 const match=String(g.saveShotsAgainst||'').match(new RegExp('([0-9]+)\\s*/\\s*([0-9]+)'));
 return match&&Number(match[2])>0&&Number(match[1])<=Number(match[2])?{saves:Number(match[1]),faced:Number(match[2])}:null;
}
function specialStats(data,team){
 const away=data.awayTeam?.abbrev===team;
 const home=data.homeTeam?.abbrev===team;if(!away&&!home)return null;
 const row=(data.teamGameStats||data.summary?.teamGameStats||[]).find(x=>/power.?play/i.test(String(x.category||x.name||'')));
 if(!row)return null;
 const parse=v=>{const m=String(v??'').match(new RegExp('([0-9]+)\\s*/\\s*([0-9]+)'));return m?[Number(m[1]),Number(m[2])]:null;};
 const own=parse(row[(away?'away':'home')+'Value']??row[(away?'away':'home')+'Team']);
 const opp=parse(row[(away?'home':'away')+'Value']??row[(away?'home':'away')+'Team']);
 return own&&opp?{ppGoals:own[0],ppChances:own[1],pkAllowed:opp[0],pkFaced:opp[1]}:null;
}
const historicalCache=new Map();
async function history(team,gameDate){
 const key=team+':'+gameDate;if(historicalCache.has(key))return historicalCache.get(key);
 const task=(async()=>{
  const season=Number(gameDate.slice(5,7))>=9?Number(gameDate.slice(0,4)):Number(gameDate.slice(0,4))-1;
  const schedule=await nhl('club-schedule-season/'+encodeURIComponent(team)+'/'+season+(season+1)).catch(async()=>{const r=await fetch('https://xxwqeiuyislnoxsmjuul.supabase.co/functions/v1/nhl-feed?kind=clubhistory&team='+encodeURIComponent(team)+'&season='+season+(season+1),{headers});if(!r.ok)throw Error('Rozpis nedostupný');return r.json();});
  const games=(schedule.games||[]).filter(g=>g.gameDate<gameDate&&g.gameState==='OFF').sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,5);
  const results=await Promise.all(games.map(async g=>{const [box,rail]=await Promise.allSettled([nhl('gamecenter/'+g.id+'/boxscore'),nhl('gamecenter/'+g.id+'/right-rail')]);return {box:box.status==='fulfilled'?box.value:null,rail:rail.status==='fulfilled'?rail.value:null};}));
  const records=results.map(x=>({sk:x.box&&skaterStats(x.box,team),goalie:x.box&&goalieStats(x.box,team),special:x.rail&&specialStats(x.rail,team)}));
  const sk=records.map(x=>x.sk).filter(Boolean),gl=records.map(x=>x.goalie).filter(Boolean),sp=records.map(x=>x.special).filter(Boolean);
  const mean=(rows,k)=>rows.length>=3?rows.reduce((a,x)=>a+x[k],0)/rows.length:null;
  const total=(rows,k)=>rows.reduce((a,x)=>a+x[k],0);
  const pp=total(sp,'ppChances'),pk=total(sp,'pkFaced'),faced=total(gl,'faced');
  return {n:sk.length,shots:mean(sk,'shots'),hits:mean(sk,'hits'),blocks:mean(sk,'blocks'),pim:mean(sk,'pim'),goalieN:gl.length,savePct:gl.length>=3&&faced>0?100*total(gl,'saves')/faced:null,specialN:sp.length,ppPct:sp.length>=3&&pp>0?100*total(sp,'ppGoals')/pp:null,pkPct:sp.length>=3&&pk>0?100*(pk-total(sp,'pkAllowed'))/pk:null};
 })();
 historicalCache.set(key,task);return task;
}

function mount(){
 const hub=document.getElementById('banger-prediction-hub');
 if(!hub||document.getElementById('banger-tv-stats'))return;
 const el=document.createElement('details');el.id='banger-tv-stats';el.className='analyst-fold';
 el.innerHTML='<summary>📺 BANGER TV MATCH STATS <small>Předzápasová televizní tabulka</small></summary><div class="analyst-fold-body"><p id="banger-tv-status">Načítám…</p><div id="banger-tv-board"></div></div>';
 hub.appendChild(el);
 const status=el.querySelector('#banger-tv-status'),board=el.querySelector('#banger-tv-board');
 (async()=>{try{
  const [archive,shadow,preview]=await Promise.all([
   fetchRows('nhl_prediction_archive?select=game_id,game_date,away_team,home_team,status,core41_away,core41_home,core42_away,core42_home,advanced_away,advanced_home,experimental_away,experimental_home&status=eq.pending&order=game_date.asc&limit=40'),
   fetchRows('core43_shadow_predictions_v1?select=game_id,core42_away,core42_home,core43_away,core43_home,experiment_status&limit=100').catch(()=>[]),
   fetchRows('core43_shadow_preview_v1?select=game_id,core43_preview_away,core43_preview_home,away_gsax_per100,home_gsax_per100,preview_status&limit=100').catch(()=>[])
  ]);
  if(!archive.length){status.textContent='Žádné neodehrané zápasy v archivu.';return;}
  const byId=rows=>new Map(rows.map(x=>[String(x.game_id),x]));
  const s=byId(shadow),p=byId(preview);
  board.innerHTML='<select aria-label="Vybrat zápas" id="banger-tv-select" style="width:100%;padding:10px;background:#0c2942;color:white;border:1px solid #4597b4;border-radius:9px;margin-bottom:10px">'+archive.map(x=>'<option value="'+safe(x.game_id)+'">'+safe(x.game_date)+' · '+safe(x.away_team)+' – '+safe(x.home_team)+'</option>').join('')+'</select><div id="banger-tv-table"></div>';
  const sel=board.querySelector('select'),target=board.querySelector('#banger-tv-table');
  function draw(){
   const g=archive.find(x=>String(x.game_id)===sel.value);if(!g)return;
   const a=s.get(sel.value)||{},b=p.get(sel.value)||{};
   const row=(label,away,home)=>'<tr><td style="text-align:center;font-weight:700">'+fmt(away)+'</td><td style="text-align:center;color:#9fcee3">'+safe(label)+'</td><td style="text-align:center;font-weight:700">'+fmt(home)+'</td></tr>';
   target.innerHTML='<div style="background:#081e33;border:1px solid #357a9a;border-radius:12px;padding:10px;overflow:auto"><div style="text-align:center;color:#70eaff;font-weight:800;margin:6px">BANGER NHL LIVE · TV PREGAME</div><table style="width:100%;table-layout:fixed;font-size:12px"><thead><tr><th>'+safe(g.away_team)+'</th><th>STATISTIKA</th><th>'+safe(g.home_team)+'</th></tr></thead><tbody>'+
   row('CORE 4.2 · góly',a.core42_away??g.core42_away,a.core42_home??g.core42_home)+
   row('CORE 4.1 · góly',g.core41_away,g.core41_home)+
   row('CORE 3.1 · góly',g.advanced_away,g.advanced_home)+
   row('xG model · góly',g.experimental_away,g.experimental_home)+
   row('CORE 4.3 · ověřený',a.core43_away,a.core43_home)+
   row('CORE 4.3 · náhled',b.core43_preview_away,b.core43_preview_home)+
   row('GSAx / 100 · vstup',b.away_gsax_per100,b.home_gsax_per100)+
   '</tbody></table><p style="font-size:11px;color:#aac5d7">CORE 4.3 náhled není validovaná predikce. Střely, hity, bloky, trestné minuty a speciální týmy jsou v podrobném reportu zatím historické průměry, nikoliv archivované predikce konkrétního zápasu. Nevytváříme pro ně neověřená čísla.</p></div>';
  }
  let generation=0;
  async function drawHistory(){
   const token=++generation;draw();
   const g=archive.find(x=>String(x.game_id)===sel.value);if(!g)return;
   const target=board.querySelector('#banger-tv-table > div');if(!target)return;
   const section=document.createElement('section');section.style.cssText='margin-top:12px;border-top:1px solid #35647f;padding-top:10px';
   section.textContent='Načítám historické týmové statistiky…';target.appendChild(section);
   try{
    const [ar,hr]=await Promise.allSettled([history(g.away_team,g.game_date),history(g.home_team,g.game_date)]);
    const empty={n:0,shots:null,hits:null,blocks:null,pim:null,goalieN:0,savePct:null,specialN:0,ppPct:null,pkPct:null};
    const away=ar.status==='fulfilled'?ar.value:empty,home=hr.status==='fulfilled'?hr.value:empty;
    if(token!==generation||!section.isConnected)return;
    const line=(label,k,suffix='')=>'<tr><td style="text-align:center">'+(away[k]==null?'—':fmt(away[k])+suffix)+'</td><td style="text-align:center;color:#a9d4e5">'+label+'</td><td style="text-align:center">'+(home[k]==null?'—':fmt(home[k])+suffix)+'</td></tr>';
    section.innerHTML='<div style="color:#70eaff;text-align:center;font-weight:800;margin-bottom:7px">POSLEDNÍCH AŽ 5 ZÁPASŮ · PRŮMĚRY</div><table style="width:100%;table-layout:fixed;font-size:12px"><tbody>'+
     line('Střely na branku','shots')+line('Hity','hits')+line('Blokované střely','blocks')+line('Trestné minuty','pim')+
     line('Úspěšnost zákroků','savePct',' %')+line('Přesilovky','ppPct',' %')+line('Oslabení','pkPct',' %')+
     '</tbody></table><p style="font-size:11px;color:#9dbed2">Vzorek týmových boxscore: '+away.n+' / '+home.n+' zápasů. Úspěšnost brankářů vychází ze startujících brankářů v posledních zápasech, nikoliv z potvrzené sestavy příštího utkání. U speciálních týmů je požadováno alespoň 3 utkání. Historické průměry nejsou predikce CORE. Nedostupné hodnoty zobrazujeme jako pomlčku.</p>';
   }catch(e){if(token===generation&&section.isConnected)section.textContent='Historické statistiky se nepodařilo načíst. Predikce CORE zůstávají dostupné.';}
  }
  sel.addEventListener('change',drawHistory);drawHistory();status.textContent='Modelové predikce Supabase + historické statistiky NHL';
 }catch(e){status.textContent='Načtení TV statistik selhalo: '+e.message;}})();
}
const obs=new MutationObserver(()=>{if(document.getElementById('banger-prediction-hub')&&!document.getElementById('banger-tv-stats'))mount();});
function start(){obs.observe(document.body,{childList:true,subtree:true});mount();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();