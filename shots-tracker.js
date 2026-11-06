/* BANGER SHOTS TRACKER 1.0 — browser archive, never rewrite a saved pregame forecast */
(()=>{'use strict';
const KEY='banger-shots-tracker-v1',API='https://api-web.nhle.com/v1/gamecenter/';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const write=data=>{try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}};
const num=v=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))?Number(v):null;
function collect(){
 const store=read();
 document.querySelectorAll('.analyst-expert-report[data-banger-projections]').forEach(el=>{
  let p;try{p=JSON.parse(decodeURIComponent(el.dataset.bangerProjections))}catch{return}
  const id=String(p.gameId||'');
  if(!/^\\d{8,12}$/.test(id)||store[id]||num(p.shots?.away)===null||num(p.shots?.home)===null)return;
  // A pregame record is saved only when the game is still upcoming, verified by NHL boxscore.
  if(el.dataset.shotsArchiveCheck)return;
  el.dataset.shotsArchiveCheck='1';
  fetch(API+id+'/boxscore').then(r=>r.ok?r.json():null).then(g=>{
   if(!g||!['FUT','PRE'].includes(String(g.gameState||'').toUpperCase()))return;
   const latest=read();if(latest[id])return;
   latest[id]={id,away:p.away,home:p.home,forecastAway:num(p.shots.away),forecastHome:num(p.shots.home),createdAt:new Date().toISOString(),status:'pending',version:p.shotsModel||'shots-v1'};
   write(latest);render();
  }).catch(()=>{});
 });
}
function actual(g,side){
 const stat=g?.[side+'Team']?.sog ?? g?.[side+'Team']?.shotsOnGoal;
 return num(stat);
}
async function evaluate(){
 const data=read(),pending=Object.values(data).filter(x=>x.status==='pending').slice(0,12);
 for(const row of pending){
  try{
   const response=await fetch(API+encodeURIComponent(row.id)+'/boxscore');
   if(!response.ok)continue;const game=await response.json();
   if(!['OFF','FINAL'].includes(String(game.gameState||'').toUpperCase()))continue;
   const a=actual(game,'away'),h=actual(game,'home');
   if(a===null||h===null)continue;
   const current=read();if(!current[row.id]||current[row.id].status!=='pending')continue;
   current[row.id]={...current[row.id],status:'final',actualAway:a,actualHome:h,finalizedAt:new Date().toISOString()};write(current);
  }catch{}
 }
 render();
}
function render(){
 const host=document.querySelector('#bangerShotsTracker');if(!host)return;
 const rows=Object.values(read()),done=rows.filter(r=>r.status==='final'),pending=rows.length-done.length;
 const mae=done.length?done.reduce((sum,r)=>sum+Math.abs(r.forecastAway-r.actualAway)+Math.abs(r.forecastHome-r.actualHome),0)/(2*done.length):null;
 const safe=s=>String(s||'').replace(/[&<>"']/g,'');
 host.innerHTML='<h4 style="margin:0 0 8px">🎯 Shots Engine · kontrola přesnosti</h4><p>Vyhodnoceno <b>'+done.length+'</b> · čeká <b>'+pending+'</b> · MAE střel na tým <b>'+(mae===null?'—':mae.toFixed(2))+'</b></p><p class="analysis-small">Lokální archiv tohoto prohlížeče. Předpověď se ukládá pouze před začátkem zápasu; po skončení se doplní oficiální střely NHL. Není synchronizován mezi zařízeními.</p>'+
 done.slice(-6).reverse().map(r=>'<div class="analysis-small" style="padding:6px 0;border-top:1px solid #ffffff22">'+safe(r.away)+' – '+safe(r.home)+' · odhad '+r.forecastAway+' : '+r.forecastHome+' · skutečnost '+r.actualAway+' : '+r.actualHome+'</div>').join('');
}
function mount(){
 const hub=document.querySelector('#bangerAccuracyComparison');if(!hub)return;
 if(document.querySelector('#bangerShotsTracker'))return;
 const el=document.createElement('section');el.id='bangerShotsTracker';el.style.cssText='margin:14px 0;padding:14px;border:1px solid #3c8fb2;border-radius:14px;background:linear-gradient(135deg,#102b43,#071a2e)';
 hub.insertAdjacentElement('afterend',el);render();
}
let scheduled=false;
function scan(){mount();collect()}
function start(){scan();evaluate();new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan()})}).observe(document.body,{childList:true,subtree:true});document.addEventListener('visibilitychange',()=>{if(!document.hidden)evaluate()})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();