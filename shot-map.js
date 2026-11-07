/* BANGER SHOT MAP 3.1 — official event coordinates; no inferred pass paths. */
(()=>{'use strict';
const css=document.createElement('style');css.textContent=`
.banger-shotmap{margin:12px 0 18px;padding:12px;border:1px solid #367c9b;border-radius:15px;background:linear-gradient(145deg,#102b43,#071a2c);color:#e9f8ff}
.banger-shotmap h4{margin:0 0 8px;font-size:15px}.banger-shotmap .shotmap-tools{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}
.banger-shotmap button{background:#163e57;border:1px solid #438ba7;color:#e8faff;padding:7px 10px;border-radius:9px;font-size:12px;cursor:pointer}
.banger-shotmap button[aria-pressed=true]{background:#176d83;border-color:#7de7ef}
.banger-shotmap svg{width:100%;height:auto;display:block;border-radius:10px;background:#d7eff4}
.banger-shotmap .shotmap-detail{font-size:12px;line-height:1.5;margin-top:9px;color:#c2e7f4;min-height:35px}
.banger-shotmap select{background:#163e57;color:#e8faff;border:1px solid #438ba7;border-radius:8px;padding:7px;max-width:100%;font-size:12px}.banger-shotmap .shotmap-selects{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px}.banger-shotmap .shotmap-timeline{margin-top:9px;padding:9px;border:1px solid #36627b;border-radius:10px;background:#0b2639;font-size:12px;line-height:1.6}.banger-shotmap .shotmap-timeline ol{padding-left:20px;margin:5px 0}.banger-shotmap .shotmap-legend{font-size:11px;color:#9fc7d9;margin-top:7px}
`;document.head.appendChild(css);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const team=t=>String(t?.name?.default||t?.name||[t?.placeName?.default,t?.commonName?.default].filter(Boolean).join(' ')||t?.abbrev||'Tým');
const types={'goal':'Gól','shot-on-goal':'Střela na branku','missed-shot':'Mimo branku','blocked-shot':'Zblokovaná střela'};
const shotTypes={wrist:'zápěstí',slap:'příklep',snap:'švih',backhand:'bekhend','tip-in':'teč',deflected:'teč'};
function render(data,root){
 if(!root||!data?.plays)return;
 const names=new Map((data.rosterSpots||[]).map(p=>[p.playerId,[p.firstName?.default,p.lastName?.default].filter(Boolean).join(' ')]));
 const teams=new Map([[data.awayTeam?.id,team(data.awayTeam)],[data.homeTeam?.id,team(data.homeTeam)]]);
 const points=data.plays.filter(p=>types[p.typeDescKey]).map(p=>{
 const v=p.details||{},x=Number(v.xCoord),y=Number(v.yCoord);
 if(v.xCoord==null||v.yCoord==null||!Number.isFinite(x)||!Number.isFinite(y)||Math.abs(x)>100||Math.abs(y)>43)return null;
 return {p,v,x,y,player:names.get(v.scoringPlayerId||v.shootingPlayerId)||'Neznámý střelec',team:teams.get(v.eventOwnerTeamId)||'Neznámý tým'};
 }).filter(Boolean);
 const box=document.createElement('section');box.className='banger-shotmap';
 box.innerHTML='<h4>🎯 Mapa střel · NHL</h4><div class="shotmap-tools"><button type="button" data-filter="all" aria-pressed="true">Všechny</button><button type="button" data-filter="goal" aria-pressed="false">🥅 Góly</button><button type="button" data-filter="shot-on-goal" aria-pressed="false">🧤 Na branku</button><button type="button" data-filter="missed-shot" aria-pressed="false">↗ Mimo</button><button type="button" data-filter="blocked-shot" aria-pressed="false">🛡 Bloky</button></div><svg viewBox="0 0 220 105" role="img" aria-label="Hokejové kluziště s polohami střel"></svg><div class="shotmap-detail" aria-live="polite"></div><div class="shotmap-legend">Polohy pocházejí ze souřadnic událostí NHL. Nejde o dráhu puku ani o přesné místo zásahu branky.</div>';
 const controls=document.createElement('div');controls.className='shotmap-selects';controls.innerHTML='<select aria-label="Filtrovat tým"><option value="all">Oba týmy</option></select><select aria-label="Filtrovat třetinu"><option value="all">Celý zápas</option></select>';box.querySelector('.shotmap-tools').after(controls);const teamSelect=controls.children[0],periodSelect=controls.children[1];[...new Set(points.map(q=>q.team))].forEach(t=>teamSelect.add(new Option(t,t)));[...new Set(points.map(q=>q.p.periodDescriptor?.number).filter(Boolean))].sort((a,b)=>a-b).forEach(p=>periodSelect.add(new Option(p+'. třetina',String(p))));const timeline=document.createElement('div');timeline.className='shotmap-timeline';timeline.hidden=true;box.querySelector('.shotmap-detail').after(timeline);root.prepend(box);const svg=box.querySelector('svg'),detail=box.querySelector('.shotmap-detail');
 let filter='all',focused=null;
 function seconds(p){const [m,sec]=String(p.timeInPeriod||'0:00').split(':').map(Number);return (m||0)*60+(sec||0)}
 function draw(reset=true){
 const selected=points.filter(q=>(filter==='all'||q.p.typeDescKey===filter)&&(teamSelect.value==='all'||q.team===teamSelect.value)&&(periodSelect.value==='all'||String(q.p.periodDescriptor?.number)===periodSelect.value));
 const lines=['<rect x="1" y="1" width="218" height="103" rx="22" fill="#d7eff4" stroke="#478aa5" stroke-width="2"/>','<path d="M73 2V103 M147 2V103" stroke="#df4f59" stroke-width="1.5"/>','<path d="M110 2V103" stroke="#3c78ad" stroke-width="1.8"/>','<circle cx="110" cy="52.5" r="15" fill="none" stroke="#3c78ad" stroke-width="1.2"/>','<circle cx="34" cy="52.5" r="14" fill="none" stroke="#df4f59" stroke-width="1"/>','<circle cx="186" cy="52.5" r="14" fill="none" stroke="#df4f59" stroke-width="1"/>','<path d="M21 47V58 M199 47V58" stroke="#cc334b" stroke-width="3"/>'];
 selected.forEach((q,i)=>{const cx=110+q.x,cy=52.5-q.y,goal=q.p.typeDescKey==='goal',active=focused===q.p.eventId;lines.push('<circle data-point="'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+(active?5.6:goal?3.8:2.4)+'" fill="'+(goal?'#efb72e':q.p.typeDescKey==='blocked-shot'?'#a05ac6':q.p.typeDescKey==='missed-shot'?'#e27559':'#176f9a')+'" stroke="#12324b" stroke-width="'+(active?2:0.5)+'" tabindex="0" role="button"><title>'+esc(q.player+' · '+types[q.p.typeDescKey])+'</title></circle>')});
 svg.innerHTML=lines.join('');
 const show=q=>{focused=q.p.eventId;const shot=shotTypes[String(q.v.shotType||'').toLowerCase()];const distance=Math.round(Math.hypot(89-Math.abs(q.x),q.y)*0.3048);detail.textContent=types[q.p.typeDescKey]+' · '+q.player+' · '+q.team+' · '+(q.p.timeInPeriod||'—')+' / '+(q.p.periodDescriptor?.number||'—')+'. třetina'+(shot?' · '+shot:'')+(Math.abs(q.x)<=89&&distance<=30?' · přibližně '+distance+' m':'')+'.';if(q.p.typeDescKey==='goal'){const period=q.p.periodDescriptor?.number;const now=seconds(q.p);const recent=data.plays.filter(p=>p.eventId!==q.p.eventId&&p.periodDescriptor?.number===period&&seconds(p)<=now&&now-seconds(p)<=45&&['shot-on-goal','missed-shot','blocked-shot','faceoff','takeaway','giveaway','hit','penalty'].includes(p.typeDescKey)).slice(-6);timeline.hidden=false;timeline.innerHTML='<strong>🎞️ Zaznamenané události před gólem</strong>'+(recent.length?'<ol>'+recent.map(p=>'<li>'+esc(p.timeInPeriod||'')+' · '+esc(({ 'shot-on-goal':'Střela na branku','missed-shot':'Střela mimo','blocked-shot':'Zblokovaná střela','faceoff':'Vhazování','takeaway':'Zisk puku','giveaway':'Ztráta puku','hit':'Bodyček','penalty':'Vyloučení'})[p.typeDescKey])+'</li>').join('')+'</ol>':'<p>Bez dalších zaznamenaných událostí v posledních 45 sekundách.</p>')+'<small>Časová posloupnost není potvrzením přímé návaznosti ani přihrávek.</small>';}else timeline.hidden=true;draw(false)};
 svg.querySelectorAll('[data-point]').forEach(el=>{const q=selected[Number(el.getAttribute('data-point'))];el.addEventListener('click',()=>show(q));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(q)}})});
 if(reset)detail.textContent=selected.length?'Zobrazeno '+selected.length+' událostí. Klepnutím na bod zobrazíš podrobnosti.':'Pro tento filtr nejsou dostupné souřadnice střel.';
 }
 box.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;box.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()}));
 teamSelect.addEventListener('change',()=>{focused=null;timeline.hidden=true;draw()});periodSelect.addEventListener('change',()=>{focused=null;timeline.hidden=true;draw()});
 box.bangerFocusGoal=id=>{const q=points.find(q=>String(q.p.eventId)===String(id));if(!q)return;filter='goal';box.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter==='goal')));teamSelect.value=q.team;periodSelect.value=String(q.p.periodDescriptor?.number);focused=q.p.eventId;draw();const target=[...svg.querySelectorAll('[data-point]')].find(el=>points.some(p=>p.p.eventId===q.p.eventId));if(target)target.dispatchEvent(new Event('click'));box.scrollIntoView({behavior:'smooth',block:'start'});};
 draw();
}
window.bangerRenderShotMap=render;
})();