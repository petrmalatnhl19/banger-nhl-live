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
#bangerEngineLab .lab-controls{display:flex;gap:8px;overflow-x:auto;overscroll-behavior-x:contain;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;margin:15px 0;padding:4px 2px 11px;scrollbar-width:thin;scrollbar-color:#357a98 transparent}
#bangerEngineLab .lab-controls button{flex:0 0 auto;white-space:nowrap;scroll-snap-align:start;min-height:44px}
#bangerEngineLab .lab-controls button:focus-visible{outline:2px solid #7af3ff;outline-offset:2px}
#bangerEngineLab .lab-controls button[aria-pressed=true]{box-shadow:0 0 0 1px #6be4ff66,0 6px 18px #00c8ff22}
#bangerEngineLab .lab-mobile-hint{font-size:11px;color:#8dbed1;margin-top:-9px;margin-bottom:9px}
#bangerEngineLab .lab-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}
#bangerEngineLab .lab-summary>div{padding:12px;border:1px solid #356a86;border-radius:13px;background:#0c2c42;min-width:0}
#bangerEngineLab .lab-summary strong{display:block;font-size:clamp(17px,3.7vw,24px);color:#b5f4ff;overflow-wrap:anywhere}
#bangerEngineLab .lab-summary small{color:#9bc4d8;font-size:11px}
@media(max-width:520px){#bangerEngineLab{padding:12px;border-radius:15px}#bangerEngineLab .lab-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#bangerEngineLab .lab-card{padding:10px;min-height:110px}#bangerEngineLab .lab-card strong{font-size:15px}#bangerEngineLab .lab-details{padding:10px}#bangerEngineLab .lab-summary>div{padding:9px}#bangerEngineLab .lab-head{align-items:flex-start}}
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
#bangerEngineLab .lab-error-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:10px;margin-top:12px}
#bangerEngineLab .lab-error-card{min-width:0}
#bangerEngineLab .lab-pattern-card{min-width:0}
#bangerEngineLab .lab-pattern-item{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #3c789b55;font-size:12px}
#bangerEngineLab .lab-pattern-item>div{min-width:0;overflow-wrap:anywhere}
#bangerEngineLab .lab-pattern-item>div:last-child{text-align:right}
#bangerEngineLab .lab-pattern-item small{display:block;color:#a6c9d9}
@media(max-width:520px){#bangerEngineLab .lab-pattern-item{flex-direction:column;gap:3px}#bangerEngineLab .lab-pattern-item>div:last-child{text-align:left}}
#bangerEngineLab .lab-error-entry{border-top:1px solid #3c789b55}
#bangerEngineLab .lab-error-entry .lab-error-row{border-top:0}
#bangerEngineLab .lab-factor-details{padding:0 0 12px;font-size:12px}
#bangerEngineLab .lab-factor-details summary{cursor:pointer;color:#80e6ff;padding:6px 0;min-height:32px;font-weight:700}
#bangerEngineLab .lab-factor-details summary:focus-visible{outline:2px solid #7af3ff}
#bangerEngineLab .lab-factor-details small{display:block;color:#a6c9d9;line-height:1.55;margin-top:7px}
#bangerEngineLab .lab-factor-raw{margin-top:9px;border-top:1px solid #2b5777;padding-top:8px}
#bangerEngineLab .lab-factor-raw summary{color:#b5f4ff}
#bangerEngineLab .lab-factor-source{margin:10px 0;padding:9px;background:#0c2d43;border-radius:9px;overflow-wrap:anywhere}
#bangerEngineLab .lab-factor-source>b{display:block;margin-bottom:6px;color:#9be7fc}
#bangerEngineLab .lab-factor-line{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #2b577744;font-size:11px}
#bangerEngineLab .lab-factor-line span:last-child{text-align:right}
@media(max-width:520px){#bangerEngineLab .lab-factor-line{flex-direction:column;gap:2px}#bangerEngineLab .lab-factor-line span:last-child{text-align:left}}
#bangerEngineLab .lab-error-row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #3c789b55;font-size:12px}
#bangerEngineLab .lab-error-row:first-of-type{margin-top:10px}
#bangerEngineLab .lab-error-row small{display:block;color:#a6c9d9;line-height:1.5}
#bangerEngineLab .lab-error-numbers{text-align:right;min-width:140px}
#bangerEngineLab .lab-error-numbers>b{color:#ffcf92}
@media(max-width:520px){#bangerEngineLab .lab-error-row{flex-direction:column;gap:4px}#bangerEngineLab .lab-error-numbers{text-align:left;min-width:0}}
`;document.head.appendChild(style);
function mount(){
 const hub=document.getElementById('bangerPredictionHubContent');if(!hub||document.getElementById('bangerEngineLab'))return;
 const lab=document.createElement('section');lab.id='bangerEngineLab';
 lab.innerHTML='<div class="lab-head"><div><div class="lab-title">⚙️ BANGER ENGINE LAB</div><div class="lab-sub">Řídicí centrum predikčních modelů · data, přesnost a vývoj</div></div><span class="lab-pill">● MODEL MONITOR</span></div><div class="lab-summary"><div><strong>5</strong><small>Gólových modelů</small></div><div><strong>1</strong><small>Shots Engine</small></div><div><strong data-lab-final>—</strong><small>Dokončených zápasů</small></div></div><div class="lab-controls" role="group" aria-label="Přehled Engine Lab"><button type="button" data-lab-tab="models" aria-pressed="true">🧠 Modely</button><button type="button" data-lab-tab="accuracy" aria-pressed="false">🎯 Přesnost</button><button type="button" data-lab-tab="shots" aria-pressed="false">🏒 Shots</button><button type="button" data-lab-tab="diagnostics" aria-pressed="false">🔬 Diagnostika</button><button type="button" data-lab-tab="calibration" aria-pressed="false">🧪 Kalibrace</button><button type="button" data-lab-tab="stability" aria-pressed="false">📡 Stabilita</button><button type="button" data-lab-tab="errors" aria-pressed="false">🧩 Největší chyby</button><button type="button" data-lab-tab="patterns" aria-pressed="false">📊 Vzorce faktorů</button><button type="button" data-lab-tab="quality" aria-pressed="false">🛡️ Kvalita dat</button></div><div class="lab-mobile-hint">← Posunutím nabídky zobrazíš další moduly →</div><div data-lab-content aria-live="polite"></div>';
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
function errorsPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const specs=[['CORE 3.0','baseline'],['xG','experimental'],['CORE 3.1','advanced'],['CORE 3.2','goalie32'],['CORE 3.3','special33']];
 const ok=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const finals=rows.filter(r=>r.status==='final'&&ok(r.actual_away)&&ok(r.actual_home));
 const cards=specs.map(([name,key])=>{
  const valid=finals.filter(r=>ok(r[key+'_away'])&&ok(r[key+'_home']));
  if(!valid.length)return '<article class="lab-card"><strong>'+name+'</strong><small>Zatím nejsou dokončené zápasy s archivovanou predikcí.</small></article>';
  const ranked=valid.map(r=>{
   const away=Math.abs(Number(r[key+'_away'])-Number(r.actual_away));
   const home=Math.abs(Number(r[key+'_home'])-Number(r.actual_home));
   return {r,away,home,mae:(away+home)/2};
  }).sort((a,b)=>b.mae-a.mae||String(b.r.game_date).localeCompare(String(a.r.game_date)));
  const lines=ranked.slice(0,5).map((v,i)=>{
   const r=v.r,score=Number(r.actual_away)+' : '+Number(r.actual_home);
   const predicted=Number(r[key+'_away']).toFixed(1)+' : '+Number(r[key+'_home']).toFixed(1);
   const teams=esc(r.away_team)+' – '+esc(r.home_team);
   const other=specs.filter(([,k])=>ok(r[k+'_away'])&&ok(r[k+'_home'])).map(([n,k])=>{
    const a=Number(r[k+'_away']),h=Number(r[k+'_home']);
    const e=(Math.abs(a-Number(r.actual_away))+Math.abs(h-Number(r.actual_home)))/2;
    return {n,k,a,h,e};
   });
   const base=other.find(x=>x.k==='baseline');
   const comparisons=other.map(x=>{
    const delta=base?(x.e-base.e):null;
    const deltaLabel=delta===null?'':(' · vůči CORE 3.0 '+(delta>0?'+':'')+delta.toFixed(2));
    return '<div class="lab-factor-line"><span>'+esc(x.n)+'</span><span>'+x.a.toFixed(1)+' : '+x.h.toFixed(1)+' · MAE '+x.e.toFixed(2)+deltaLabel+'</span></div>';
   }).join('');
   const factors=[['CORE 3.1 · vstupy','advanced_factors'],['CORE 3.2 · brankáři','goalie32_factors'],['CORE 3.3 · speciální týmy','special33_factors']].map(([label,field])=>{
    let raw=r[field];
    if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(_){raw=raw.trim()}}
    if(raw===null||raw===undefined||raw==='')return '';
    let entries=[];
    if(Array.isArray(raw))entries=raw.slice(0,18).map((v,i)=>[String(i+1),v]);
    else if(typeof raw==='object')entries=Object.entries(raw).slice(0,24);
    else entries=[['Hodnota',raw]];
    const printable=v=>{
     if(v===null||v===undefined)return '—';
     if(typeof v==='object')return JSON.stringify(v).slice(0,250);
     return String(v).slice(0,250);
    };
    return '<div class="lab-factor-source"><b>'+esc(label)+'</b>'+entries.map(([k,v])=>'<div class="lab-factor-line"><span>'+esc(k)+'</span><span>'+esc(printable(v))+'</span></div>').join('')+'</div>';
   }).filter(Boolean).join('');
   const notes=[];
   const goalie=other.find(x=>x.k==='goalie32'),special=other.find(x=>x.k==='special33');
   if(base&&goalie)notes.push('Brankářský model mění odhad vůči CORE 3.0 o '+(Math.abs(goalie.a-base.a)+Math.abs(goalie.h-base.h)).toFixed(2)+' gólu v součtu absolutních změn.');
   if(base&&special)notes.push('Model speciálních týmů mění odhad vůči CORE 3.0 o '+(Math.abs(special.a-base.a)+Math.abs(special.h-base.h)).toFixed(2)+' gólu v součtu absolutních změn.');
   return '<div class="lab-error-entry"><div class="lab-error-row"><div><span class="lab-pill">#'+(i+1)+'</span> <b>'+teams+'</b><small>'+esc(r.game_date)+'</small></div><div class="lab-error-numbers"><b>MAE '+v.mae.toFixed(2)+'</b><small>Odhad '+predicted+' · výsledek '+score+'</small><small>Chyba hosté '+v.away.toFixed(1)+' · domácí '+v.home.toFixed(1)+'</small></div></div><details class="lab-factor-details"><summary>Rozbor rozdílů modelů</summary><div class="lab-factor-list">'+comparisons+'</div><small>'+(notes.length?notes.map(esc).join('<br>'):'Pro tento zápas nejsou dostupná všechna srovnání.')+'</small><details class="lab-factor-raw"><summary>Archivované vstupní faktory</summary>'+(factors||'<small>Pro tento zápas zatím nebyly vstupní faktory uloženy.</small>')+'</details><small>Archivované faktory ukazují, jaké hodnoty byly u modelu zaznamenány. Samy o sobě neprokazují příčinu chyby; pro spolehlivý závěr je potřeba více zápasů.</small></details></div>';
  }).join('');
  const overall=ranked.reduce((sum,v)=>sum+v.mae,0)/ranked.length;
  return '<article class="lab-card lab-error-card"><span class="lab-pill">'+ranked.length+' VYHODNOCENÝCH</span><strong>'+name+'</strong><small>Celková MAE '+overall.toFixed(2)+' · pět největších odchylek</small>'+lines+'</article>';
 }).join('');
 return '<div class="lab-details"><b>🧩 Největší chyby jednotlivých modelů</b><p class="analysis-small">Pět zápasů s nejvyšší absolutní chybou předpovězených gólů na tým. U každého zápasu lze rozbalit srovnání modelů a archivované vstupní faktory CORE 3.1–3.3, pokud byly uloženy. Pouze dokončené zápasy s uloženou predikcí. Tento přehled ukazuje, kde se model mýlil, nikoliv proč; příčiny musíme ověřit další analýzou.</p><div class="lab-error-grid">'+cards+'</div><p class="analysis-small">Pořadí je počítané samostatně pro každý model. Vzorky se mohou lišit a výsledky nejsou důkazem budoucí přesnosti.</p></div>';
}
function patternsPanel(){
 const rows=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive:[];
 const models=[['CORE 3.1','advanced','advanced_factors'],['CORE 3.2','goalie32','goalie32_factors'],['CORE 3.3','special33','special33_factors']];
 const ok=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const final=rows.filter(r=>r.status==='final'&&ok(r.actual_away)&&ok(r.actual_home));
 const sections=models.map(([name,key,field])=>{
  const valid=final.filter(r=>ok(r[key+'_away'])&&ok(r[key+'_home']));
  const records=[];
  valid.forEach(r=>{
   let obj=r[field];if(typeof obj==='string'){try{obj=JSON.parse(obj)}catch(_){return}}
   if(!obj||typeof obj!=='object'||Array.isArray(obj))return;
   const mae=(Math.abs(Number(r[key+'_away'])-Number(r.actual_away))+Math.abs(Number(r[key+'_home'])-Number(r.actual_home)))/2;
   Object.entries(obj).forEach(([factor,value])=>{
    if(!/^[\w .-]{1,70}$/.test(factor)||!ok(value)||typeof value==='boolean')return;
    const num=Number(value);
    if(!Number.isFinite(num)||Math.abs(num)>1e9)return;
    records.push({factor,value:num,mae,game:String(r.game_id)});
   });
  });
  const grouped=new Map();
  records.forEach(x=>{if(!grouped.has(x.factor))grouped.set(x.factor,[]);grouped.get(x.factor).push(x)});
  const eligible=[...grouped].map(([factor,points])=>{
   const unique=[...new Map(points.map(p=>[p.game,p])).values()].sort((a,b)=>a.value-b.value);
   if(unique.length<20||unique[0].value===unique[unique.length-1].value)return null;
   const half=Math.floor(unique.length/2),low=unique.slice(0,half),high=unique.slice(-half);
   const avg=arr=>arr.reduce((sum,p)=>sum+p.mae,0)/arr.length;
   return {factor,n:unique.length,low:avg(low),high:avg(high),delta:avg(high)-avg(low),min:unique[0].value,max:unique[unique.length-1].value};
  }).filter(Boolean).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)).slice(0,8);
  const content=eligible.length?eligible.map(x=>'<div class="lab-pattern-item"><div><b>'+esc(x.factor)+'</b><small>n='+x.n+' · rozsah '+x.min.toFixed(2)+' až '+x.max.toFixed(2)+'</small></div><div><b style="color:'+(x.delta>0?'#ffd08b':'#7df0bf')+'">'+(x.delta>0?'+':'')+x.delta.toFixed(2)+'</b><small>MAE nižší polovina '+x.low.toFixed(2)+' · vyšší '+x.high.toFixed(2)+'</small></div></div>').join(''):'<small>Dosud nemáme alespoň 20 dokončených zápasů s různými číselnými hodnotami stejného faktoru. Analýza se zpřístupní automaticky.</small>';
  return '<article class="lab-card lab-pattern-card"><span class="lab-pill">'+valid.length+' PREDIKCÍ S VÝSLEDKEM</span><strong>'+name+'</strong><small>Vyhodnocené číselné faktory: '+eligible.length+'</small>'+content+'</article>';
 }).join('');
 return '<div class="lab-details"><b>📊 Vzorce chyb podle archivovaných faktorů</b><p class="analysis-small">Pro každý číselný faktor porovnáváme průměrnou chybu MAE u nižší a vyšší poloviny jeho hodnot. Rozdíl = MAE vyšší poloviny minus MAE nižší poloviny. Kladný rozdíl značí větší chybu při vyšších hodnotách faktoru. Každá polovina vyžaduje alespoň 10 zápasů; řadíme podle absolutní velikosti rozdílu, což může zvýraznit náhodné výkyvy.</p><div class="lab-error-grid">'+sections+'</div><p class="analysis-small">Jde o průzkumnou souvislost, nikoli prokázanou příčinu. Vnořené či textové faktory zatím nevyhodnocujeme. Žádné váhy modelů se automaticky nemění.</p></div>';
}
function qualityPanel(){
 const rows=window.bangerEngineLabArchive;
 if(!Array.isArray(rows))return '<div class="lab-details">Čekám na načtení archivu.</div>';
 const ok=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const specs=[['CORE 3.0','baseline',null],['xG','experimental',null],['CORE 3.1','advanced','advanced_factors'],['CORE 3.2','goalie32','goalie32_factors'],['CORE 3.3','special33','special33_factors']];
 const cards=specs.map(([name,key,factor])=>{
  const valid=rows.filter(r=>ok(r[key+'_away'])&&ok(r[key+'_home']));
  const partial=rows.filter(r=>ok(r[key+'_away'])!==ok(r[key+'_home'])).length;
  const stored=factor?valid.filter(r=>r[factor]!==null&&r[factor]!==undefined).length:null;
  return '<article class="lab-card"><strong>'+name+'</strong><small>Kompletní odhady: '+valid.length+' / '+rows.length+'<br>Neúplné dvojice: '+partial+(factor?'<br>Uložené faktory: '+stored+' / '+valid.length:'')+'</small></article>';
 }).join('');
 const duplicates=rows.length-new Set(rows.map(r=>String(r.game_id))).size;
 const completed=rows.filter(r=>r.status==='final');
 const missingScores=completed.filter(r=>!ok(r.actual_away)||!ok(r.actual_home)).length;
 return '<div class="lab-details"><b>🛡️ Kontrola kvality dat</b><p class="analysis-small">Pouze čtení archivu. Žádné predikce ani výsledky se neupravují.</p><div class="lab-grid">'+cards+'</div><p class="analysis-small">Dokončených zápasů: '+completed.length+' · Duplicitních ID ve výpisu: '+duplicates+' · Dokončené bez úplného skóre: '+missingScores+'.</p><p class="analysis-small">Tato kontrola sleduje dostupnost hodnot, nikoliv jejich správnost. Bez přesného času začátku utkání nelze ověřit, zda všechny odhady vznikly před zápasem.</p></div>';
}
function update(){
 const lab=document.getElementById('bangerEngineLab');if(!lab)return;
 const tab=lab.dataset.tab||'models';
 lab.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===tab)));
 const body=lab.querySelector('[data-lab-content]');
 const finalCount=Array.isArray(window.bangerEngineLabArchive)?window.bangerEngineLabArchive.filter(r=>r.status==='final').length:null;
 const finalEl=lab.querySelector('[data-lab-final]');if(finalEl)finalEl.textContent=finalCount===null?'—':String(finalCount);
 if(tab==='quality'){
  body.innerHTML=qualityPanel();
 }else if(tab==='patterns'){
  body.innerHTML=patternsPanel();
 }else if(tab==='errors'){
  body.innerHTML=errorsPanel();
 }else if(tab==='stability'){
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
function refresh(){mount();const lab=document.getElementById('bangerEngineLab');if(!lab||lab.dataset.tab==='models')return;const source=[document.getElementById('bangerAccuracyComparison')?.parentElement?.textContent||'',document.getElementById('bangerShotsTracker')?.textContent||'',String(window.bangerEngineLabArchive?.length??'')].join('|');if(source!==last){last=source;update()}}
function start(){refresh();window.addEventListener('banger-engine-lab-archive',()=>{if(['accuracy','diagnostics','calibration','stability','errors','patterns','quality'].includes(document.getElementById('bangerEngineLab')?.dataset.tab))update()});setInterval(refresh,2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();