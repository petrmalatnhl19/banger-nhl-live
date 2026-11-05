/* BANGER Expert Report UX 5.0 — presentation only, prediction math untouched */
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
@media(max-width:600px){.analysis-panel .analyst-expert-report>summary{font-size:15px!important}.banger-report-section>summary{min-height:48px}}
`;
function section(title,items,open){const el=document.createElement('details');el.className='banger-report-section';el.open=!!open;const summary=document.createElement('summary');summary.textContent=title;const body=document.createElement('div');body.className='banger-report-section-body';items.forEach(n=>body.appendChild(n));el.append(summary,body);return el}
function enhance(report){
 if(report.dataset.bangerReportUx==='5')return;
 const body=report.querySelector(':scope > .analyst-fold-body');if(!body)return;
 const nodes=Array.from(body.children);if(nodes.length<2)return;
 const intro=document.createElement('div');intro.className='banger-report-intro';intro.innerHTML='<strong>🧠 BANGER | Expertní rozbor</strong><span>Čti nejdřív hlavní závěry. Detailní podklady rozbal podle potřeby. Neověřené údaje zůstávají označené.</span>';
 const groups=[[],[],[],[]];let group=0;
 nodes.forEach(node=>{
 const txt=(node.textContent||'').toLowerCase();
 if(/brankář|goalie|gólman|sestav/.test(txt.slice(0,120)))group=1;
 else if(/hráč|útoční|obránc|player/.test(txt.slice(0,120)))group=2;
 else if(/založeno na dostupných|nejde o generativní ai/.test(txt))group=3;
 groups[group].push(node);
 });
 body.replaceChildren(intro);
 const titles=['🎯 Závěry a kontext zápasu','🥅 Brankáři a sestavy','🏒 Hráči a jejich forma','ℹ️ Zdroje a omezení'];
 groups.forEach((items,i)=>{if(items.length)body.appendChild(section(titles[i],items,i===0))});
 report.dataset.bangerReportUx='5';
}
function scan(){document.querySelectorAll('.analysis-panel .analyst-expert-report').forEach(enhance)}
function start(){if(!document.getElementById('banger-report-ux-style')){const style=document.createElement('style');style.id='banger-report-ux-style';style.textContent=CSS;document.head.appendChild(style)}scan();let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;scan()})}).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
