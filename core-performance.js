(()=>{'use strict';
const ROOT='https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/';
const APIKEY='sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G';
let lastLoad=0;
const fmt=(n,d=1)=>n==null?'—':Number(n).toLocaleString('cs-CZ',{minimumFractionDigits:d,maximumFractionDigits:d});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const styles=document.createElement('style');styles.textContent=`
#corePerformancePanel{margin:16px 0;padding:18px;border:1px solid #48d9ff66;border-radius:18px;background:linear-gradient(135deg,#123653,#081a30);color:#e5f6ff;box-shadow:0 10px 32px #0004}
#corePerformancePanel h3{font-size:20px;margin:0 0 8px;color:#b7f5ff}
#corePerformancePanel p{margin:7px 0 12px;color:#a8c9dc;font-size:13px}
#corePerformancePanel .core-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
#corePerformancePanel button{border:1px solid #4ac9e5;border-radius:11px;padding:9px 13px;background:#153d5c;color:#e8fbff;cursor:pointer;font-weight:700}
#corePerformancePanel button[aria-pressed=true]{background:#176c85}
#corePerformancePanel .core-scroll{overflow-x:auto}
#corePerformancePanel table{width:100%;border-collapse:collapse;font-size:13px;min-width:440px}
#corePerformancePanel th,#corePerformancePanel td{padding:10px 8px;text-align:left;border-bottom:1px solid #7cc8e533}
#corePerformancePanel th{color:#9adfeb}#corePerformancePanel td:first-child{font-weight:750}
`;document.head.appendChild(styles);
function table(rows){if(!rows.length)return '<p>Zatím nejsou k dispozici vyhodnocené zápasy.</p>';return '<div class="core-scroll"><table><thead><tr><th>Model</th><th>Zápasy</th><th>Vítěz</th><th>Chyba gólů</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.model)+'</td><td>'+esc(r.games)+'</td><td>'+fmt(r.winner_accuracy_pct)+' %</td><td>'+fmt(r.goal_mae,3)+'</td></tr>').join('')+'</tbody></table></div>'}
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
  const [all,paired]=await Promise.all([fetchView('nhl_core_model_accuracy'),fetchView('nhl_core_model_head_to_head')]);
  if(!panel.isConnected)return;
  panel._coreData={all,paired};
  lastLoad=Date.now();
  render(panel);
 }catch(e){
  if(panel.isConnected){
   area.textContent=e?.name==='AbortError'?'Načítání překročilo 9 sekund. Zkus Aktualizovat.':'Přehled se nepodařilo načíst: '+String(e?.message||e);
  }
 }finally{clearTimeout(timeout);panel._loading=false}
}
function render(panel){const data=panel._coreData;if(!data)return;const mode=panel.dataset.mode||'paired';const rows=data[mode]||[];panel.querySelector('[data-core-body]').innerHTML=table(rows);panel.querySelector('[data-core-caption]').textContent=mode==='paired'?'Srovnání na stejných zápasech. Menší chyba gólů je lepší.':'Všechny dostupné dokončené zápasy pro každý model. Počty zápasů se mohou lišit.';panel.querySelectorAll('[data-core-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.coreMode===mode)))}
function attach(){if(typeof S==='undefined'||S.tab!=='analyst')return;const target=document.getElementById('content');if(!target||document.getElementById('corePerformancePanel'))return;const panel=document.createElement('section');panel.id='corePerformancePanel';panel.dataset.mode='paired';panel.innerHTML='<h3>📊 Výkonnost CORE</h3><p>Skutečná přesnost předzápasových modelů podle dokončených utkání NHL.</p><div class="core-tabs"><button type="button" data-core-mode="paired" aria-pressed="true">Stejné zápasy</button><button type="button" data-core-mode="all" aria-pressed="false">Všechny zápasy</button><button type="button" data-core-refresh>↻ Aktualizovat</button></div><p data-core-caption></p><div data-core-body aria-live="polite">Načítám…</div>';panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.coreMode){panel.dataset.mode=b.dataset.coreMode;render(panel)}else if(b.hasAttribute('data-core-refresh'))load(panel)});target.prepend(panel);load(panel)}
const observer=new MutationObserver(()=>{if((typeof S!=='undefined'?S.tab:null)==='analyst')attach()});observer.observe(document.getElementById('content')||document.body,{childList:true});document.addEventListener('click',()=>setTimeout(attach,100));attach();
})();