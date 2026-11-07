/* BANGER SHOT MAP 3.1 — official event coordinates; no inferred pass paths. */
(()=>{'use strict';
const css=document.createElement('style');css.textContent=`
.banger-shotmap{margin:12px 0 18px;padding:12px;border:1px solid #367c9b;border-radius:15px;background:linear-gradient(145deg,#102b43,#071a2c);color:#e9f8ff}
.banger-shotmap h4{margin:0 0 8px;font-size:15px}.banger-shotmap .shotmap-tools{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0}
.banger-shotmap button{background:#163e57;border:1px solid #438ba7;color:#e8faff;padding:7px 10px;border-radius:9px;font-size:12px;cursor:pointer}
.banger-shotmap button[aria-pressed=true]{background:#176d83;border-color:#7de7ef}
.banger-shotmap svg{width:100%;height:auto;display:block;border-radius:10px;background:#d7eff4}
.banger-shotmap .shotmap-detail{font-size:12px;line-height:1.5;margin-top:9px;color:#c2e7f4;min-height:35px}
.banger-shotmap .shotmap-legend{font-size:11px;color:#9fc7d9;margin-top:7px}
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
 root.prepend(box);const svg=box.querySelector('svg'),detail=box.querySelector('.shotmap-detail');
 let filter='all';
 function draw(){
 const selected=points.filter(q=>filter==='all'||q.p.typeDescKey===filter);
 const lines=['<rect x="1" y="1" width="218" height="103" rx="22" fill="#d7eff4" stroke="#478aa5" stroke-width="2"/>','<path d="M73 2V103 M147 2V103" stroke="#df4f59" stroke-width="1.5"/>','<path d="M110 2V103" stroke="#3c78ad" stroke-width="1.8"/>','<circle cx="110" cy="52.5" r="15" fill="none" stroke="#3c78ad" stroke-width="1.2"/>','<circle cx="34" cy="52.5" r="14" fill="none" stroke="#df4f59" stroke-width="1"/>','<circle cx="186" cy="52.5" r="14" fill="none" stroke="#df4f59" stroke-width="1"/>','<path d="M21 47V58 M199 47V58" stroke="#cc334b" stroke-width="3"/>'];
 selected.forEach((q,i)=>{const cx=110+q.x,cy=52.5-q.y,goal=q.p.typeDescKey==='goal';lines.push('<circle data-point="'+i+'" cx="'+cx+'" cy="'+cy+'" r="'+(goal?3.8:2.4)+'" fill="'+(goal?'#efb72e':q.p.typeDescKey==='blocked-shot'?'#a05ac6':q.p.typeDescKey==='missed-shot'?'#e27559':'#176f9a')+'" stroke="#12324b" stroke-width=".5" tabindex="0" role="button"><title>'+esc(q.player+' · '+types[q.p.typeDescKey])+'</title></circle>')});
 svg.innerHTML=lines.join('');
 const show=q=>{const shot=shotTypes[String(q.v.shotType||'').toLowerCase()];const distance=Math.round(Math.hypot(89-Math.abs(q.x),q.y)*0.3048);detail.textContent=types[q.p.typeDescKey]+' · '+q.player+' · '+q.team+' · '+(q.p.timeInPeriod||'—')+' / '+(q.p.periodDescriptor?.number||'—')+'. třetina'+(shot?' · '+shot:'')+(Math.abs(q.x)<=89&&distance<=30?' · přibližně '+distance+' m':'')+'.'};
 svg.querySelectorAll('[data-point]').forEach(el=>{const q=selected[Number(el.getAttribute('data-point'))];el.addEventListener('click',()=>show(q));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show(q)}})});
 detail.textContent=selected.length?'Zobrazeno '+selected.length+' událostí. Klepnutím na bod zobrazíš podrobnosti.':'Pro tento filtr nejsou dostupné souřadnice střel.';
 }
 box.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;box.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));draw()}));
 draw();
}
window.bangerRenderShotMap=render;
})();