/* BANGER Expert Report UX 6.0 — presentation only, prediction math untouched */
(()=>{'use strict';
const CSS=`
.analysis-panel .analyst-expert-report{border:1px solid #4bd8f588!important;border-radius:19px!important;overflow:hidden;background:linear-gradient(150deg,#0d2946,#091529)!important;box-shadow:0 12px 35px #0005}
.analysis-panel .analyst-expert-report>summary{padding:17px!important;font-size:16px!important;font-weight:850;letter-spacing:.2px}
.analysis-panel .analyst-expert-report>.analyst-fold-body{padding:12px!important}
.banger-report-intro{padding:15px;border:1px solid #5bd7f455;border-radius:15px;background:linear-gradient(125deg,#153b58,#0a223a);margin-bottom:12px}
.banger-report-intro strong{display:block;color:#8ceaff;font-size:16px;margin-bottom:5px}
.banger-report-intro span{color:#b8d6e7;font-size:12px;line-height:1.5}
.banger-report-section{border:1px solid #427c9966;border-radius:13px;margin:9px 0;overflow:hidden;background:#081b30}
.banger-report-section>summary{cursor:pointer;list-style:none;padding:13px 12px!important;display:flex;justify-content:space-between;align-items:center;gap:10px;color:#e7faff!important;font-size:14px!important;font-weight:750}
.banger-report-section>summary::-webkit-details-marker{display:none}
.banger-report-section>summary:after{content:'+';color:#71e7fa;font-size:22px;line-height:1}
.banger-report-section[open]>summary:after{content:'−'}
.banger-report-section[open]>summary{border-bottom:1px solid #427c9955;background:#12334c}
.banger-report-section-body{padding:11px 13px;overflow-wrap:anywhere}
.banger-report-section-body h4{margin:10px 0 7px!important;font-size:14px!important;color:#8ceaff}
.banger-report-section-body p{font-size:13px!important;line-height:1.6!important}
.banger-report-audio{margin:8px 0!important;padding:9px!important;border:1px solid #315a78!important;border-radius:12px!important}
.banger-report-audio button{font-size:12px!important;padding:8px 10px!important;min-height:35px!important}
.banger-report-audio select{max-width:100%;font-size:12px!important}
.banger-report-audio h3{font-size:13px!important}
.banger-report-section-body>h4{padding-top:10px;border-top:1px solid #23465e}
.banger-report-section-body>h4:first-child{border-top:0;padding-top:0}
.banger-report-section-body .analysis-section{max-width:100%;overflow-wrap:anywhere}
@media(max-width:600px){.analysis-panel .analyst-expert-report>summary{font-size:15px!important}.banger-report-section>summary{min-height:48px}}
`;
function section(title,items,open){const el=document.createElement('details');el.className='banger-report-section';el.open=!!open;const summary=document.createElement('summary');summary.textContent=title;const body=document.createElement('div');body.className='banger-report-section-body';items.forEach(n=>body.appendChild(n));el.append(summary,body);return el}
function enhance(report){
 if(report.dataset.bangerReportUx==='6')return;
 const body=report.querySelector(':scope > .analyst-fold-body');if(!body)return;
 const nodes=Array.from(body.children);if(nodes.length<2)return;
 const groups=Array.from({length:6},()=>[]),notes=[];let current=0;
 const classify=title=>{
  const t=title.toLowerCase();
  if(/tracker|kontrola dat|diagnostik|vážený predikční model|advanced stats|přesnost|kalibrac|datové zdroje/.test(t))return 5;
  if(/přesilov|oslaben|trest|fyzická náročnost|speciální týmy/.test(t))return 4;
  if(/brankář|goalie|gólman|sestav/.test(t))return 2;
  if(/hráč|útoční|obránc|individual|individuál|střelc/.test(t))return 3;
  if(/vzájemn|forma|tabulkov|odpočinek|program|střelecká aktivita|střely, hity|celkový obraz|srovnání týmů/.test(t))return 1;
  if(/verdikt|predikc|favorit|očekáv|výsledek/.test(t))return 0;
  return 1;
 };
 for(let i=0;i<nodes.length;i++){
  const node=nodes[i];
  if(node.classList.contains('banger-match-story')){groups[0].unshift(node);continue}
  if(node.classList.contains('banger-voice-controls')){notes.push(node);continue}
  if(node.tagName==='H4'){
   current=classify(node.textContent||'');groups[current].push(node);
   if(nodes[i+1]?.tagName==='P')groups[current].push(nodes[++i]);
   continue;
  }
  if(node.matches('section.analysis-section')){
   current=classify(node.querySelector('h3,h4')?.textContent||'');groups[current].push(node);continue;
  }
  if(node.matches('p.analysis-small')&&(/Automatický datový rozbor|Založeno na dostupných/.test(node.textContent||''))){notes.push(node);continue}
  groups[current].push(node);
 }
 const intro=document.createElement('div');intro.className='banger-report-intro';
 intro.innerHTML='<strong>🏒 BANGER | Analýza zápasu</strong><span>Nejdřív projekce, potom důvody. Každý údaj zůstává dohledatelný v příslušné sekci.</span>';
 body.replaceChildren(intro);
 const titles=['🎯 Predikce zápasu','📊 Srovnání týmů','🥅 Brankáři a sestavy','🏒 Hráči','⚡ Speciální týmy','🧠 BANGER AI Engine'];
 groups.forEach((items,i)=>{if(items.length)body.appendChild(section(titles[i],items,i===0))});
 if(notes.length)body.appendChild(section('🔊 Poslech a informace',notes,false));
 report.dataset.bangerReportUx='6';
}
function scan(){document.querySelectorAll('.analysis-panel .analyst-expert-report').forEach(enhance)}
function start(){if(!document.getElementById('banger-report-ux-style')){const style=document.createElement('style');style.id='banger-report-ux-style';style.textContent=CSS;document.head.appendChild(style)}scan();let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;scan()})}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
