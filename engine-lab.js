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
 lab.innerHTML='<div class="lab-head"><div><div class="lab-title">⚙️ BANGER ENGINE LAB</div><div class="lab-sub">Řídicí centrum predikčních modelů · data, přesnost a vývoj</div></div><span class="lab-pill">● MODEL MONITOR</span></div><div class="lab-controls" role="group" aria-label="Přehled Engine Lab"><button type="button" data-lab-tab="models" aria-pressed="true">🧠 Modely</button><button type="button" data-lab-tab="accuracy" aria-pressed="false">🎯 Přesnost</button><button type="button" data-lab-tab="shots" aria-pressed="false">🏒 Shots</button></div><div data-lab-content aria-live="polite"></div>';
 hub.insertBefore(lab,hub.firstChild);
 lab.addEventListener('click',e=>{const b=e.target.closest('[data-lab-tab]');if(!b)return;lab.dataset.tab=b.dataset.labTab;update()});
 lab.dataset.tab='models';update();
}
function update(){
 const lab=document.getElementById('bangerEngineLab');if(!lab)return;
 const tab=lab.dataset.tab||'models';
 lab.querySelectorAll('[data-lab-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.labTab===tab)));
 const body=lab.querySelector('[data-lab-content]');
 if(tab==='models'){
  body.innerHTML='<div class="lab-grid">'+MODELS.map(([name,description],i)=>'<article class="lab-card"><span class="lab-pill">ENGINE '+String(i+1).padStart(2,'0')+'</span><strong>'+name+'</strong><small>'+description+'</small></article>').join('')+'</div><div class="lab-details"><b>Jak modely spolupracují?</b><p class="analysis-small">Gólové modely vytvářejí samostatné odhady, které lze zpětně porovnávat na stejných dokončených utkáních. Shots Engine sleduje střely zvlášť; jeho MAE nelze přímo srovnávat s MAE gólů.</p></div>';
 }else if(tab==='accuracy'){
  const status=document.getElementById('bangerAccuracyStatus');
  const source=document.getElementById('bangerAccuracyComparison');
  const ranking=source?.parentElement?.querySelector('h4')?.closest('div');
  const candidate=[...(source?.parentElement?.querySelectorAll('div')||[])].find(e=>e.querySelector('h4')?.textContent?.includes('Žebříček přesnosti'));
  body.innerHTML='<div class="lab-details"><b>📊 Centrální vyhodnocení gólových modelů</b><p class="analysis-small" data-lab-status></p><div data-lab-ranking></div><p class="analysis-small">Nižší MAE = menší chyba odhadovaných gólů. Žebříček se počítá pouze ze zápasů, které mají všechny porovnávané modely.</p></div>';
  body.querySelector('[data-lab-status]').textContent=status?.textContent||'Čekám na načtení výsledků.';
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
function start(){refresh();setInterval(refresh,2500)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();