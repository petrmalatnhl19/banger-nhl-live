/* BANGER TV MATCH STATS — read-only; never modifies CORE predictions. */
(()=>{'use strict';
const base='https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/';
const headers={apikey:'sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G'};
const fmt=v=>v==null||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('cs-CZ',{minimumFractionDigits:2,maximumFractionDigits:2});
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function fetchRows(q){const r=await fetch(base+q,{headers});if(!r.ok)throw Error('HTTP '+r.status);return r.json();}
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
  sel.addEventListener('change',draw);draw();status.textContent='Skutečné uložené výstupy modelů · Supabase';
 }catch(e){status.textContent='Načtení TV statistik selhalo: '+e.message;}})();
}
const obs=new MutationObserver(()=>{if(document.getElementById('banger-prediction-hub')&&!document.getElementById('banger-tv-stats'))mount();});
function start(){obs.observe(document.body,{childList:true,subtree:true});mount();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();