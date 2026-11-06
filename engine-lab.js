/* BANGER ENGINE LAB 1.0 — analytical model dashboard */
(()=>{'use strict';
const MODELS=[
 ['CORE 3.0','Základní gólový model','baseline'],['xG','Experimentální očekávané góly','experimental'],['CORE 3.1','Rozšířené týmové faktory','advanced'],['CORE 3.2','Brankářské faktory','goalie32'],['CORE 3.3','Přesilovky a oslabení','special33'],['SHOTS 1.0','Střely a obrana soupeře','shots']
];
const style=document.createElement('style');style.textContent=`
#bangerEngineLab{margin:12px 0 18px;padding:16px;border:1px solid #38c9ed80;border-radius:20px;background:radial-gradient(circle at 100% 0%,#14516d 0%,#09283e 48%,#071728 100%);color:#e6f8ff;box-shadow:0 12px 35px #0004}
#bangerEngineLab .lab-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
#bangerEngineLab .lab-title{font-size:clamp(19px,4vw,27px);font-weight:900;letter-spacing:.05em}
#bangerEngineLab .lab-sub{color:#9ac6da;font-size:12px}
#bangerEngineLab .lab-controls{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0}
#bangerEngineLab button{border:1px solid #4288a8;background:#102d45;color:#dcf7ff;border-radius:12px;padding:10px 12px;font-weight:750;cursor:pointer}
#bangerEngineLab button[aria-pressed=true]{background:linear-gradient(120deg,#1687a9,#14587a);border-color:#6be4ff}
#bangerEngineLab .lab-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px}
#bangerEngineLab .lab-card{border:1px solid #3c789b88;background:linear-gradient(145deg,#133b55,#092033);border-radius:14px;padding:13px;min-height:120px}
#bangerEngineLab .lab-card strong{display:block;font-size:17px;margin:5px 0}
#bangerEngineLab .lab-card small{display:block;color:#a6c9d9;line-height:1.5}
#bangerEngineLab .lab-pill{font-size:10px;letter-spacing:.08em;color:#78e8fa}
#bangerEngineLab .lab-details{margin-top:12px;padding:12px;border-radius:13px;background:#061a2b;border:1px solid #35617c}
#bangerEngineLab .lab-bar{height:7px;background:#22415a;border-radius:10px;overflow:hidden;margin-top:7px}
#bangerEngineLab .lab-bar span{display:block;height:100%;background:linear-gradient(90deg,#21b3e8,#6cf1bd)}
`;document.head.appendChild(style);
function mount(){
 const hub=document.getElementById('bangerPredictionHubContent');if(!hub||document.getElementById('bangerEngineLab'))return;
 const lab=document.createElement('section');lab.id='bangerEngineLab';
 lab.innerHTML='<div class="lab-head"><div><div class="lab-title">⚙️ BANGER ENGINE LAB</div><div class="lab-sub">Řídicí centrum predikčních modelů · data, přesnost a vývoj</div></div><span class="lab-pill">● MODEL MONITOR</span></div><div class="lab-controls" role="group" aria-label="Přehled Engine Lab"><button type="button" data-lab-tab="models" aria-pressed="true">🧠 Modely</button><button type="button" data-lab-tab="accuracy" aria-pressed="false">🎯 Přesnost</button><button type="button" data-lab-tab="shots" aria-pressed="false">🏒 Shots</button><button type="button" data-lab-tab="diagnostics" aria-pressed="false">🔬 Diagnostika</button><button type="button" data-lab-tab="calibration" aria-pressed="false">🧪 Kalibrace</button><button type="button" data-lab-tab="stability" aria-pressed="false">📡 Stabilita</button></div><div data-lab-content aria-live="polite"></div>';
 hub.insertBefore(lab,hub.firstChild);
 lab.addEventListener('click',e=>{const b=e.target.closest('[data-lab-tab]');if(!b)return;lab.dataset.tab=b.dataset.labTab;update()});
 lab.dataset.tab='models';update();
}
function trendPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const specs=[['CORE 3.0','baseline'],['xG','experimental'],['CORE 3.1','advanced'],['CORE 3.2','goalie32'],['CORE 3.3','special33']];
 const valid=rows.filter(r=>r.status==='final'&&Number.isFinite(Number(r.actual_away))&&Number.isFinite(Number(r.actual_home))&&r.actual_away!==null&&r.actual_home!==null)
  .sort((a,b)=>String(a.game_date).localeCompare(String(b.game_date))||Number(a.game_id)-Number(b.game_id));
 const common=valid.filter(r=>specs.every(([,key])=>r[key+'_away']!==null&&r[key+'_home']!==null&&Number.isFinite(Number(r[key+'_away']))&&Number.isFinite(Number(r[key+'_home']))));
 if(!common.length)return '<p class="analysis-small">Čekáme na společný dokončený vzorek všech pěti modelů. Graf se objeví po vyhodnocení.</p>';
 const colors=['#65d9f6','#ffd06c','#91f6ad','#db9eff','#ff929d'];
 const traces=specs.map(([name,key],i)=>({name,color:colors[i],points:common.map((r,index)=>{
  const error=(Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)))/2;
  return error;
 })}));
 const width=660,height=225,pad={left:34,right:12,top:16,bottom:28};
 const max=Math.max(1,...traces.flatMap(t=>t.points));
 const x=i=>pad.left+(common.length===1?0.5:i/(common.length-1))*(width-pad.left-pad.right);
 const y=v=>height-pad.bottom-(v/max)*(height-pad.top-pad.bottom);
 const grid=[0,.25,.5,.75,1].map(f=>'<line x1="'+pad.left+'" y1="'+y(max*f)+'" x2="'+(width-pad.right)+'" y2="'+y(max*f)+'" stroke="#45627b" stroke-opacity=".45"/><text x="3" y="'+(y(max*f)+4)+'" fill="#a6c9d9" font-size="11">'+(max*f).toFixed(1)+'</text>').join('');
 const paths=traces.map(t=>{
  let total=0;const points=t.points.map((v,i)=>{total+=v;return x(i).toFixed(1)+','+y(total/(i+1)).toFixed(1)}).join(' ');
  return '<polyline points="'+points+'" fill="none" stroke="'+t.color+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
 }).join('');
 const legend=traces.map(t=>'<span style="display:inline-flex;align-items:center;gap:5px"><i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+t.color+'"></i>'+t.name+'</span>').join('');
 return '<div style="margin-top:14px"><b>📈 Vývoj kumulativní MAE</b><p class="analysis-small">Všech pět modelů na stejných '+common.length+' dokončených zápasech. Každý bod = průměrná chyba od začátku vzorku. Nižší křivka je lepší.</p><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Kumulativní průměrná absolutní chyba modelů v čase" style="width:100%;height:auto;max-height:260px">'+grid+paths+'</svg><div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#c5e0ed">'+legend+'</div></div>';
}
function diagnosticsPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const specs=[['CORE 3.0','baseline'],['xG','experimental'],['CORE 3.1','advanced'],['CORE 3.2','goalie32'],['CORE 3.3','special33']];
 const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const completed=rows.filter(r=>r.status==='final'&&numeric(r.actual_away)&&numeric(r.actual_home));
 const groups=[
  ['Vysoké skóre',r=>Number(r.actual_away)+Number(r.actual_home)>=7],
  ['Nízké skóre',r=>Number(r.actual_away)+Number(r.actual_home)<=4],
  ['Těsný výsledek',r=>Math.abs(Number(r.actual_away)-Number(r.actual_home))<=1],
  ['Výrazný rozdíl',r=>Math.abs(Number(r.actual_away)-Number(r.actual_home))>=3]
 ];
 const cards=groups.map(([title,test])=>{
  const subset=completed.filter(test);
  const values=specs.map(([name,key])=>{
   const valid=subset.filter(r=>numeric(r[key+'_away'])&&numeric(r[key+'_home']));
   const mae=valid.length?valid.reduce((sum,r)=>sum+(Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)))/2,0)/valid.length:null;
   return {name,mae,n:valid.length};
  });
  const comparable=subset.filter(r=>specs.every(([,key])=>numeric(r[key+'_away'])&&numeric(r[key+'_home'])));
  const commonScores=specs.map(([name,key])=>({name,n:comparable.length,mae:comparable.length?comparable.reduce((sum,r)=>sum+(Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)))/2,0)/comparable.length:null})).sort((a,b)=>(a.mae??Infinity)-(b.mae??Infinity));
  const best=comparable.length>=10?commonScores[0]:null;
  return '<article class="lab-card"><span class="lab-pill">'+subset.length+' DOKONČENÝCH</span><strong>'+title+'</strong><small>'+(best?'Nejnižší MAE na společném vzorku: '+best.name+' ('+best.mae.toFixed(2)+')':'Pro závěr čekáme alespoň na 10 společných zápasů.')+'</small><div style="margin-top:10px">'+values.map(v=>'<div style="display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:4px 0"><span>'+v.name+'</span><span>'+(v.mae===null?'—':v.mae.toFixed(2))+' <small>(n='+v.n+')</small></span></div>').join('')+'</div></article>';
 }).join('');
 return '<div class="lab-details"><b>🔬 Diagnostika chyb podle typu utkání</b><p class="analysis-small">Skupiny jsou určeny skutečným konečným skóre, tedy až po zápase. Slouží pro zpětnou analýzu, ne pro předzápasovou klasifikaci. MAE je chyba gólů na tým. V každém řádku je uveden počet dostupných predikcí.</p><div class="lab-grid">'+cards+'</div><p class="analysis-small">Malé vzorky a překrývající se skupiny mohou zkreslit výsledky. Automatické převažování modelů zatím není zapnuté.</p></div>';
}
function calibrationPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const specs=[['CORE 3.0','baseline'],['xG','experimental'],['CORE 3.1','advanced'],['CORE 3.2','goalie32'],['CORE 3.3','special33']];
 const ok=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const valid=rows.filter(r=>r.status==='final'&&ok(r.actual_away)&&ok(r.actual_home));
 const cards=specs.map(([name,key])=>{
  const sample=valid.filter(r=>ok(r[key+'_away'])&&ok(r[key+'_home']));
  if(!sample.length)return '<article class="lab-card"><strong>'+name+'</strong><small>Čeká na dokončené zápasy.</small></article>';
  const n=sample.length;
  const predicted=sample.reduce((sum,r)=>sum+Number(r[key+'_away'])+Number(r[key+'_home']),0)/(2*n);
  const actual=sample.reduce((sum,r)=>sum+Number(r.actual_away)+Number(r.actual_home),0)/(2*n);
  const bias=predicted-actual;
  const abs=sample.reduce((sum,r)=>sum+Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)),0)/(2*n);
  const label=Math.abs(bias)<.15?'Přibližně vyvážený':bias>0?'Nadhodnocuje góly':'Podhodnocuje góly';
  return '<article class="lab-card"><span class="lab-pill">'+n+' ZÁPASŮ</span><strong>'+name+'</strong><small>'+label+'</small><div style="font-size:25px;font-weight:850;margin:8px 0;color:'+(Math.abs(bias)<.15?'#78edbd':'#ffd386')+'">'+(bias>0?'+':'')+bias.toFixed(2)+' <span style="font-size:12px">gólu / tým</span></div><small>Odhad '+predicted.toFixed(2)+' · skutečnost '+actual.toFixed(2)+'<br>MAE '+abs.toFixed(2)+'</small></article>';
 }).join('');
 return '<div class="lab-details"><b>🧪 Kalibrace gólových modelů</b><p class="analysis-small">Bias = průměrně předpovězené góly minus skutečné góly na tým. Kladné číslo znamená nadhodnocení, záporné podhodnocení. MAE navíc měří velikost chyby bez ohledu na směr.</p><div class="lab-grid">'+cards+'</div><p class="analysis-small">Výsledky jsou popisné, ne automatická oprava předpovědí. Vzorky se mezi modely mohou lišit. Pro spolehlivější kalibraci potřebujeme více zápasů.</p></div>';
}
function stabilityPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const specs=[['CORE 3.0','baseline'],['xG','experimental'],['CORE 3.1','advanced'],['CORE 3.2','goalie32'],['CORE 3.3','special33']];
 const ok=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const final=rows.filter(r=>r.status==='final'&&ok(r.actual_away)&&ok(r.actual_home)).sort((a,b)=>String(a.game_date).localeCompare(String(b.game_date))||String(a.game_id).localeCompare(String(b.game_id)));
 const cards=specs.map(([name,key])=>{
  const valid=final.filter(r=>ok(r[key+'_away'])&&ok(r[key+'_home']));
  const error=r=>(Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)))/2;
  const n=10;
  if(valid.length<2*n)return '<article class="lab-card"><span class="lab-pill">'+valid.length+' / '+(2*n)+' ZÁPASŮ</span><strong>'+name+'</strong><small>Pro porovnání dvou nepřekrývajících se oken po '+n+' zápasech zatím chybí '+(2*n-valid.length)+' výsledků.</small></article>';
  const recent=valid.slice(-n),previous=valid.slice(-2*n,-n);
  const mae=sample=>sample.reduce((sum,r)=>sum+error(r),0)/sample.length;
  const a=mae(previous),b=mae(recent),delta=b-a;
  const verdict=Math.abs(delta)<.1?'Stabilní v rámci prahu':delta<0?'MAE se zlepšila':'MAE se zhoršila';
  const color=Math.abs(delta)<.1?'#b8d7e7':delta<0?'#7df0bf':'#ffd08b';
  return '<article class="lab-card"><span class="lab-pill">2 × '+n+' ZÁPASŮ</span><strong>'+name+'</strong><small>'+verdict+'</small><div style="font-size:25px;font-weight:850;color:'+color+';margin:8px 0">'+(delta>0?'+':'')+delta.toFixed(2)+' <span style="font-size:12px">MAE</span></div><small>Starší okno '+a.toFixed(2)+' → posledních '+n+' '+b.toFixed(2)+'</small></article>';
 }).join('');
 return '<div class="lab-details"><b>📡 Stabilita predikčních modelů</b><p class="analysis-small">Porovnání MAE posledních 10 dokončených zápasů s předchozími 10 zápasy každého modelu. Záporná změna znamená nižší chybu. Prah ±0,10 MAE je pouze orientační, nikoli statistický test.</p><div class="lab-grid">'+cards+'</div><p class="analysis-small">Malé vzorky mohou kolísat náhodně. Okna jednotlivých modelů mohou obsahovat jiné zápasy; výsledky proto neslouží k automatickému výběru modelu ani změně jeho vah.</p></div>';
}
function update(){
 const lab=document.getElementById('bangerEngineLab');if(!lab)return;
 const tab=lab.dataset.tab||'models';
 lab.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===tab)));
 const body=lab.querySelector('[data-lab-content]');
 if(tab==='stability'){
  body.innerHTML=stabilityPanel();
 }else if(tab==='calibration'){
  body.innerHTML=calibrationPanel();
 }else if(tab==='models'){
  body.innerHTML='<div class="lab-grid">'+MODELS.map(([name,description],i)=>'<article class="lab-card"><span class="lab-pill">ENGINE '+String(i+1).padStart(2,'0')+'</span><strong>'+name+'</strong><small>'+description+'</small></article>').join('')+'</div><div class="lab-details"><b>Jak modely spolupracují?</b><p class="analysis-small">Gólové modely vytvářejí samostatné odhady, které lze zpětně porovnávat na stejných dokončených utkáních. Shots Engine sleduje střely zvlášť; jeho MAE nelze přímo srovnávat s MAE gólů.</p></div>';
 }else if(tab==='diagnostics'){
  body.innerHTML=diagnosticsPanel();
 }else if(tab==='accuracy'){
  const status=document.getElementById('bangerAccuracyStatus');
  const source=document.getElementById('bangerAccuracyComparison');
  const ranking=source?.parentElement?.querySelector('h4')?.closest('div');
  const candidate=[...(source?.parentElement?.querySelectorAll('div')||[])].find(e=>e.querySelector('h4')?.textContent?.includes('Žebříček přesnosti'));
  body.innerHTML='<div class="lab-details"><b>📊 Centrální vyhodnocení gólových modelů</b><p class="analysis-small" data-lab-status></p><div data-lab-ranking></div><p class="analysis-small">Nižší MAE = menší chyba odhadovaných gólů. Žebříček se počítá pouze ze zápasů, které mají všechny porovnávané modely.</p></div>';
  body.querySelector('[data-lab-status]').textContent=status?.textContent||'Čekám na načtení výsledků.';
  body.querySelector('.lab-details').insertAdjacentHTML('beforeend',trendPanel());
  if(candidate)body.querySelector('[data-lab-ranking]').appendChild(candidate.cloneNode(true));
  else body.querySelector('[data-lab-ranking]').textContent='Výsledky zatím nejsou dostupné. Podrobnosti jsou v Prediction Accuracy níže.';
 }else{
  const tracker=document.getElementById('bangerShotsTracker');
  const rows=tracker?.querySelectorAll('.banger-shots-trend>div')||[];
  body.innerHTML='<div class="lab-details"><b>🎯 Shots Engine · samostatné vyhodnocení</b><p class="analysis-small" data-lab-shotstatus></p><div class="lab-grid" data-lab-shotgrid></div><p class="analysis-small">Střely jsou ukládány pouze před začátkem zápasu. Zatím jde o lokální archiv tohoto zařízení, nikoli serverovou databázi.</p></div>';
  body.querySelector('[data-lab-shotstatus]').textContent=tracker?.querySelector('p')?.textContent||'Tracker zatím není dostupný.';
  const grid=body.querySelector('[data-lab-shotgrid]');
  if(rows.length)rows.forEach(row=>{const el=document.createElement('div');el.className='lab-card';el.textContent=row.textContent;grid.appendChild(el)});
 }
}
let last='';
function refresh(){mount();const lab=document.getElementById('bangerEngineLab');if(!lab||lab.dataset.tab==='models')return;const source=[document.getElementById('bangerAccuracyComparison')?.parentElement?.textContent||'',document.getElementById('bangerShotsTracker')?.textContent||''].join('|');if(source!==last){last=source;update()}}
function start(){refresh();window.addEventListener('banger-engine-lab-archive',()=>{if(['accuracy','diagnostics','calibration','stability'].includes(document.getElementById('bangerEngineLab')?.dataset.tab))update()});setInterval(refresh,2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();