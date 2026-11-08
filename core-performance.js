(()=>{'use strict';
const ROOT='https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/';
const APIKEY='sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G';
let lastLoad=0;
const fmt=(n,d=1)=>n==null?'—':Number(n).toLocaleString('cs-CZ',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=document.createElement('style');styles.textContent=`
#corePerformancePanel{margin:12px 0;padding:14px;border:1px solid #48d9ff66;border-radius:18px;background:linear-gradient(135deg,#123653,#081a30);color:#e5f6ff;box-shadow:0 10px 32px #0004}
#corePerformancePanel h3{font-size:19px;margin:0 0 5px;color:#b7f5ff}
#corePerformancePanel p{margin:5px 0 9px;color:#a8c9dc;font-size:13px}
#corePerformancePanel .core-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:9px 0}
#corePerformancePanel button{border:1px solid #4ac9e5;border-radius:11px;padding:8px 10px;background:#153d5c;color:#e8fbff;cursor:pointer;font-weight:700}
#corePerformancePanel button[aria-pressed=true]{background:#176c85}
#corePerformancePanel .core-scroll{overflow-x:visible;width:100%}
#corePerformancePanel table{width:100%;border-collapse:collapse;font-size:clamp(11px,2.8vw,13px);table-layout:fixed;min-width:0}
#corePerformancePanel th,#corePerformancePanel td{padding:9px 3px;text-align:left;border-bottom:1px solid #7cc8e533}
#corePerformancePanel th{color:#9adfeb}#corePerformancePanel th:nth-child(1){width:29%}#corePerformancePanel th:nth-child(2){width:19%}#corePerformancePanel th:nth-child(3){width:24%}#corePerformancePanel th:nth-child(4){width:28%}#corePerformancePanel th:nth-child(n+2),#corePerformancePanel td:nth-child(n+2){text-align:right;white-space:nowrap}#corePerformancePanel .core-best{color:#8cf1c3;font-weight:800}#corePerformancePanel .core-note{font-size:11px;color:#a9c9dc}#corePerformancePanel .core-chart{margin-top:12px;padding:10px;border:1px solid #63c9ec33;border-radius:12px;background:#061a2d80}#corePerformancePanel .core-chart svg{display:block;width:100%;height:auto}#corePerformancePanel .core-chart label{display:block;margin-bottom:7px;color:#bceafa;font-size:12px}#corePerformancePanel .core-chart select{background:#153d5c;color:#fff;border:1px solid #49bfe0;border-radius:8px;padding:7px;width:100%;max-width:230px}#corePerformancePanel .core-chart .core-chart-meta{font-size:11px;color:#9dbfd0;margin:7px 0 0}#corePerformancePanel td:first-child{font-weight:750}
`;document.head.appendChild(styles);
function table(rows){
 if(!rows.length)return '<p>Zatím nejsou k dispozici vyhodnocené zápasy.</p>';
 const maxAccuracy=Math.max(...rows.map(r=>Number(r.winner_accuracy_pct)).filter(Number.isFinite));
 const minError=Math.min(...rows.map(r=>Number(r.goal_mae)).filter(Number.isFinite));
 const displayRows=rows.some(r=>r.model==='CORE 4.2')?rows:[...rows,{model:'CORE 4.2',games:0,winner_accuracy_pct:null,goal_mae:null,pending:true}];
 const html=displayRows.map(r=>{
  const accuracy=Number(r.winner_accuracy_pct),error=Number(r.goal_mae);
  const winnerBest=!r.pending&&r.winner_accuracy_pct!=null&&Number.isFinite(accuracy)&&accuracy===maxAccuracy;
  const errorBest=!r.pending&&r.goal_mae!=null&&Number.isFinite(error)&&error===minError;
  return r.pending?'<tr><td>'+esc(r.model)+'</td><td>0</td><td colspan="2" style="text-align:right;color:#a9dced">'+esc(String(window.__core42Pending??'5'))+' predikcí · čeká</td></tr>':'<tr><td>'+esc(r.model)+'</td><td>'+esc(r.games)+'</td><td class="'+(winnerBest?'core-best':'')+'">'+fmt(r.winner_accuracy_pct)+' %</td><td class="'+(errorBest?'core-best':'')+'">'+fmt(r.goal_mae,3)+'</td></tr>';
 }).join('');
 return '<div class="core-scroll"><table><thead><tr><th>Model</th><th>Záp.</th><th>Vítěz</th><th>Chyba</th></tr></thead><tbody>'+html+'</tbody></table></div><p class="core-note">Zeleně = nejlepší hodnota v zobrazeném přehledu. Chyba = průměrná odchylka gólů na tým. Malý počet zápasů znamená nejistý výsledek.</p>';
}
function renderTrend(panel){
 const box=panel.querySelector('[data-core-trend]');
 if(!box)return;
 const data=panel._coreData?.trend||[];
 const models=[...new Set(data.map(r=>r.model))];
 if(!models.length){box.innerHTML='<p>Graf zatím nemá dokončené zápasy.</p>';return}
 const selected=models.includes(panel.dataset.trendModel)?panel.dataset.trendModel:models[0];
 panel.dataset.trendModel=selected;
 const series=data.filter(r=>r.model===selected).sort((a,b)=>Number(a.games)-Number(b.games));
 const values=series.map(r=>Number(r.winner_accuracy_pct));
 const width=330,height=140,left=34,right=8,top=10,bottom=25;
 const x=i=>left+(series.length===1?0:(i/(series.length-1))*(width-left-right));
 const y=v=>top+(100-v)/100*(height-top-bottom);
 const points=values.map((v,i)=>x(i).toFixed(1)+','+y(v).toFixed(1)).join(' ');
 const ticks=[0,25,50,75,100].map(v=>'<line x1="'+left+'" y1="'+y(v)+'" x2="'+(width-right)+'" y2="'+y(v)+'" stroke="#5c9ab5" stroke-opacity=".25"/><text x="'+(left-6)+'" y="'+(y(v)+3)+'" fill="#9dbfd0" font-size="9" text-anchor="end">'+v+'</text>').join('');
 box.innerHTML='<label for="coreTrendModel">Vývoj úspěšnosti vítěze</label><select id="coreTrendModel">'+models.map(m=>'<option value="'+esc(m)+'" '+(m===selected?'selected':'')+'>'+esc(m)+'</option>').join('')+'</select><svg role="img" aria-label="Vývoj přesnosti modelu '+esc(selected)+'" viewBox="0 0 '+width+' '+height+'">'+ticks+'<polyline fill="none" stroke="#5ce6ec" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" points="'+points+'"/>'+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="2.5" fill="#a8fff1"/>').join('')+'<text x="'+left+'" y="'+(height-5)+'" fill="#a6c4d7" font-size="10">1. zápas</text><text x="'+(width-right)+'" y="'+(height-5)+'" fill="#a6c4d7" font-size="10" text-anchor="end">'+series.length+'. zápas</text></svg><p class="core-chart-meta">'+esc(selected)+' · '+series.length+' zápasů · aktuálně '+fmt(values[values.length-1])+' %. Průběžná úspěšnost od prvního zápasu.</p>';
 box.querySelector('select').addEventListener('change',e=>{panel.dataset.trendModel=e.target.value;renderTrend(panel)});
}

async function load(panel){
 if(panel._loading)return;
 panel._loading=true;
 const area=panel.querySelector('[data-core-body]');
 area.textContent='Načítám přesnost modelů…';
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),9000);
 try{
  const fetchView=async view=>{
   const response=await fetch(ROOT+view+'?select=*&order=model.asc',{
    headers:{apikey:APIKEY,Authorization:'Bearer '+APIKEY},
    signal:controller.signal,
    cache:'no-store'
   });
   if(!response.ok){const detail=await response.text().catch(()=> '');throw Error('HTTP '+response.status+(detail?' – '+detail.slice(0,120):''))}
   const result=await response.json();
   if(!Array.isArray(result))throw Error('Neplatná odpověď databáze');
   return result;
  };
  const [all,paired,trend,statusRows]=await Promise.all([fetchView('nhl_core_model_accuracy'),fetchView('nhl_core_model_head_to_head'),fetchView('nhl_core_model_trend'),fetchView('nhl_core42_status')]);
  if(!panel.isConnected)return;
  window.__core42Pending=Number(statusRows[0]?.pending_predictions??0);panel._coreData={all,paired,trend};
  lastLoad=Date.now();
  render(panel);renderTrend(panel);
 }catch(e){
  if(panel.isConnected){
   area.textContent=e?.name==='AbortError'?'Načítání překročilo 9 sekund. Zkus Aktualizovat.':'Přehled se nepodařilo načíst: '+String(e?.message||e);
  }
 }finally{clearTimeout(timeout);panel._loading=false}
}
function render(panel){const data=panel._coreData;if(!data)return;const mode=panel.dataset.mode||'paired';const rows=data[mode]||[];panel.querySelector('[data-core-body]').innerHTML=table(rows);panel.querySelector('[data-core-caption]').textContent=mode==='paired'?'Srovnání na stejných zápasech. Menší chyba gólů je lepší.':'Všechny dostupné dokončené zápasy pro každý model. Počty zápasů se mohou lišit.';panel.querySelectorAll('[data-core-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coreMode===mode)))}
function attach(){if(typeof S==='undefined'||S.tab!=='analyst')return;const target=document.getElementById('content');if(!target||document.getElementById('corePerformancePanel'))return;const panel=document.createElement('section');panel.id='corePerformancePanel';panel.dataset.mode='paired';panel.innerHTML='<h3>📊 Výkonnost CORE</h3><p>Skutečná přesnost předzápasových modelů podle dokončených utkání NHL.</p><div class="core-tabs"><button type="button" data-core-mode="paired" aria-pressed="true">Stejné zápasy</button><button type="button" data-core-mode="all" aria-pressed="false">Všechny zápasy</button><button type="button" data-core-refresh>↻ Aktualizovat</button></div><p data-core-caption></p><div data-core-body aria-live="polite">Načítám…</div><div class="core-chart" data-core-trend aria-label="Graf vývoje přesnosti"></div>';panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.coreMode){panel.dataset.mode=b.dataset.coreMode;render(panel)}else if(b.hasAttribute('data-core-refresh'))load(panel)});target.prepend(panel);load(panel)}
const observer=new MutationObserver(()=>{if((typeof S!=='undefined'?S.tab:null)==='analyst')attach()});observer.observe(document.getElementById('content')||document.body,{childList:true});document.addEventListener('click',()=>setTimeout(attach,100));attach();
})();