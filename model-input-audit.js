/* BANGER model input audit 1.0 — read-only, based on archived pregame forecasts. */
(()=>{'use strict';
const style=document.createElement('style');
style.textContent='#bangerInputAudit{margin:14px 0;padding:16px;border:1px solid #387c9e;border-radius:16px;background:linear-gradient(130deg,#102c46,#0a1b31);color:#e8f8ff}#bangerInputAudit h3{margin:0 0 8px;font-size:17px}#bangerInputAudit .audit-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:9px;margin:12px 0}#bangerInputAudit .audit-tile{border:1px solid #355c78;border-radius:11px;padding:12px;background:#102b43}#bangerInputAudit .audit-tile strong{display:block;font-size:24px;margin-top:5px}#bangerInputAudit p{line-height:1.5;margin:9px 0;color:#c4deee}#bangerInputAudit .audit-alert{color:#ffca9d}';
document.head.appendChild(style);
function valid(v){return v!==null&&v!==undefined&&Number.isFinite(Number(v))}
function render(){
 const lab=document.getElementById('bangerEngineLab'),rows=window.bangerEngineLabArchive;
 if(!lab||!Array.isArray(rows))return;
 let card=document.getElementById('bangerInputAudit');
 if(!card){card=document.createElement('section');card.id='bangerInputAudit';lab.insertBefore(card,lab.firstChild)}
 const finals=rows.filter(r=>r.status==='final');
 const pending=rows.filter(r=>r.status==='pending');
 const validated=pending.filter(r=>r.goalie32_factors?.roster_validation==='nhl_current_roster_advisory');
 const mismatches=pending.filter(r=>r.goalie32_factors?.roster_validation==='nhl_current_roster_advisory'&&(r.goalie32_factors?.roster_match_away===false||r.goalie32_factors?.roster_match_home===false));
 const available=pending.filter(r=>r.goalie32_factors?.goalie_data_missing===false);
 const goalies=finals.filter(r=>r.goalie32_factors?.goalie_data_missing===true);
 const same=finals.filter(r=>['advanced_away','advanced_home','goalie32_away','goalie32_home'].every(k=>valid(r[k]))&&Number(r.advanced_away)===Number(r.goalie32_away)&&Number(r.advanced_home)===Number(r.goalie32_home));
 const special=finals.filter(r=>['advanced_away','advanced_home','special33_away','special33_home'].every(k=>valid(r[k])));
 const changes=special.filter(r=>Number(r.advanced_away)!==Number(r.special33_away)||Number(r.advanced_home)!==Number(r.special33_home));
 const goalieComparable=pending.filter(r=>['advanced_away','advanced_home','goalie32_away','goalie32_home'].every(k=>valid(r[k])));
 const goalieChanged=goalieComparable.filter(r=>Math.abs(Number(r.advanced_away)-Number(r.goalie32_away))>0.000001||Math.abs(Number(r.advanced_home)-Number(r.goalie32_home))>0.000001);
 const goalieAvgDelta=goalieChanged.length?goalieChanged.reduce((sum,r)=>sum+(Math.abs(Number(r.advanced_away)-Number(r.goalie32_away))+Math.abs(Number(r.advanced_home)-Number(r.goalie32_home)))/2,0)/goalieChanged.length:0;
 const goalieFinals=finals.filter(r=>r.goalie32_factors?.goalie_data_missing===false&&['actual_away','actual_home','advanced_away','advanced_home','goalie32_away','goalie32_home'].every(k=>valid(r[k])));
 const mae=(subset,prefix)=>subset.length?subset.reduce((sum,r)=>sum+Math.abs(Number(r[prefix+'_away'])-Number(r.actual_away))+Math.abs(Number(r[prefix+'_home'])-Number(r.actual_home)),0)/(subset.length*2):null;
 const goalieMae=mae(goalieFinals,'goalie32'),advancedMae=mae(goalieFinals,'advanced');
 const xgComparable=finals.filter(r=>['actual_away','actual_home','baseline_away','baseline_home','experimental_away','experimental_home'].every(k=>valid(r[k])));
 const xgMae=mae(xgComparable,'experimental'),baseMae=mae(xgComparable,'baseline');
 const xgImproved=xgComparable.filter(r=>Math.abs(Number(r.experimental_away)-Number(r.actual_away))+Math.abs(Number(r.experimental_home)-Number(r.actual_home))<Math.abs(Number(r.baseline_away)-Number(r.actual_away))+Math.abs(Number(r.baseline_home)-Number(r.actual_home))).length;
 const xgWorse=xgComparable.filter(r=>Math.abs(Number(r.experimental_away)-Number(r.actual_away))+Math.abs(Number(r.experimental_home)-Number(r.actual_home))>Math.abs(Number(r.baseline_away)-Number(r.actual_away))+Math.abs(Number(r.baseline_home)-Number(r.actual_home))).length;
 const xg4Comparable=finals.filter(r=>['actual_away','actual_home','experimental_away','experimental_home','xg4_away','xg4_home'].every(k=>valid(r[k])));
 const xg4Mae=mae(xg4Comparable,'xg4'),xg3Mae=mae(xg4Comparable,'experimental');
 const xg4Pending=pending.filter(r=>['xg4_away','xg4_home'].every(k=>valid(r[k])));
 const core40Pending=pending.filter(r=>valid(r.core40_away)&&valid(r.core40_home));
 const core40Finals=finals.filter(r=>['actual_away','actual_home','core40_away','core40_home','baseline_away','baseline_home'].every(k=>valid(r[k])));
 const core40Mae=mae(core40Finals,'core40'),core40Baseline=mae(core40Finals,'baseline');
 const core40Incomplete=core40Pending.filter(r=>Array.isArray(r.core40_factors?.missing)&&r.core40_factors.missing.length>0).length;
 const core41Pending=pending.filter(r=>valid(r.core41_away)&&valid(r.core41_home));
 const core41Finals=finals.filter(r=>['actual_away','actual_home','core41_away','core41_home','core40_away','core40_home'].every(k=>valid(r[k])));
 const core41Mae=mae(core41Finals,'core41'),core40SameMae=mae(core41Finals,'core40');
 const core41Excluded=core41Pending.filter(r=>Array.isArray(r.core41_factors?.excluded)&&r.core41_factors.excluded.some(x=>x.model==='goalie32')).length;
 const goalieUnknown=finals.filter(r=>r.goalie32_factors?.goalie_data_missing===undefined).length;
 const en=window.bangerI18n?.getLanguage?.()==='en';
 const tile=(name,value)=>'<div class="audit-tile"><span>'+name+'</span><strong>'+value+'</strong></div>';
 const headline=en?'🧪 Model input audit · CORE 3.2 / 3.3':'🧪 Audit vstupů modelů · CORE 3.2 / 3.3';
 const signature=[finals.length,goalies.length,same.length,changes.length,special.length,goalieUnknown,pending.length,validated.length,mismatches.length,available.length,goalieChanged.length,goalieAvgDelta.toFixed(3),goalieFinals.length,xgComparable.length,xgMae?.toFixed(3),baseMae?.toFixed(3),xgImproved,xgWorse,xg4Comparable.length,xg4Pending.length,xg4Mae?.toFixed(3),xg3Mae?.toFixed(3),core40Pending.length,core40Finals.length,core40Mae?.toFixed(3),core40Incomplete,core41Pending.length,core41Finals.length,core41Excluded,core41Mae?.toFixed(3),en].join(':');
 if(card.dataset.signature===signature)return;card.dataset.signature=signature;
 card.innerHTML='<h3>'+headline+'</h3><p>'+(en?'Read-only checks of archived completed games. No forecasts are modified.':'Kontrola archivovaných dokončených zápasů. Žádné predikce se nemění.')+'</p><div class="audit-grid">'+tile(en?'Completed games':'Dokončené zápasy',finals.length)+tile(en?'Missing goalie data':'Chybí brankáři',goalies.length+'/'+finals.length)+tile(en?'CORE 3.2 = 3.1':'CORE 3.2 = 3.1',same.length+'/'+finals.length)+tile(en?'CORE 3.3 changed':'CORE 3.3 změnil',changes.length+'/'+special.length)+tile(en?'Pending: roster checked':'Čekající: kontrola soupisky',validated.length+'/'+pending.length)+tile(en?'Pending: goalie inputs ready':'Čekající: brankáři dostupní',available.length+'/'+pending.length)+tile(en?'Pending: roster differences':'Čekající: rozdíly v soupisce',mismatches.length+'/'+pending.length)+tile(en?'Goalie changed forecast':'Brankáři změnili predikci',goalieChanged.length+'/'+goalieComparable.length)+tile(en?'Mean goalie shift':'Průměrná změna gólů',goalieAvgDelta.toFixed(3))+tile(en?'xG MAE':'xG MAE',xgMae===null?'—':xgMae.toFixed(3))+tile(en?'CORE 3.0 MAE (same games)':'CORE 3.0 MAE (stejné zápasy)',baseMae===null?'—':baseMae.toFixed(3))+tile(en?'xG 4.0 pregame forecasts':'xG 4.0 předzápasové predikce',xg4Pending.length+'/'+pending.length)+tile(en?'xG 4.0 MAE':'xG 4.0 MAE',xg4Mae===null?'—':xg4Mae.toFixed(3))+tile('CORE 4.0',core40Pending.length+'/'+pending.length)+tile('CORE 4.0 MAE',core40Mae===null?'—':core40Mae.toFixed(3))+tile('CORE 4.1',core41Pending.length+'/'+pending.length)+tile(en?'Goalie data excluded':'Vynechaný brankář',core41Excluded)+tile('CORE 4.1 MAE',core41Mae===null?'—':core41Mae.toFixed(3))+'</div>'+
 '<p class="audit-alert">'+(goalies.length?en?'⚠ Goalie adjustments are unavailable in '+goalies.length+' completed games. CORE 3.2 may fall back to CORE 3.1.':'⚠ U '+goalies.length+' dokončených zápasů chybí brankářská data. CORE 3.2 může přebírat CORE 3.1.':en?'No explicit missing-goalie flags in completed games.':'U dokončených zápasů nejsou výslovně označena chybějící brankářská data.')+'</p>'+
 '<p>'+(goalieFinals.length?(en?'Goalie model evaluated on '+goalieFinals.length+' completed games: CORE 3.2 MAE '+goalieMae.toFixed(3)+' vs CORE 3.1 '+advancedMae.toFixed(3)+'.':'Brankářský model vyhodnocen na '+goalieFinals.length+' dokončených zápasech: CORE 3.2 MAE '+goalieMae.toFixed(3)+' proti CORE 3.1 '+advancedMae.toFixed(3)+'.'):(en?'Goalie impact on accuracy cannot yet be evaluated: no completed games with full goalie inputs.':'Vliv brankářů na přesnost zatím nelze vyhodnotit: chybí dokončené zápasy s úplnými brankářskými daty.'))+'</p>'+
 '<p>'+(xgComparable.length?(en?'xG versus CORE 3.0 on the same '+xgComparable.length+' completed games: xG MAE '+xgMae.toFixed(3)+' · CORE MAE '+baseMae.toFixed(3)+'. xG improved '+xgImproved+' games and worsened '+xgWorse+'.':'xG proti CORE 3.0 na stejných '+xgComparable.length+' dokončených zápasech: xG MAE '+xgMae.toFixed(3)+' · CORE MAE '+baseMae.toFixed(3)+'. xG zlepšilo '+xgImproved+' zápasů, zhoršilo '+xgWorse+'.'):(en?'Not enough completed xG forecasts to compare.':'Zatím nejsou dokončené xG predikce pro porovnání.'))+'</p>'+
 '<p>'+(xg4Comparable.length?(en?'xG 4.0 MAE '+xg4Mae.toFixed(3)+' vs xG share MAE '+xg3Mae.toFixed(3)+' on '+xg4Comparable.length+' identical finished games.':'xG 4.0 MAE '+xg4Mae.toFixed(3)+' proti xG podílu MAE '+xg3Mae.toFixed(3)+' na '+xg4Comparable.length+' stejných dokončených zápasech.'):(en?'xG 4.0 is awaiting completed games with pregame snapshots.':'xG 4.0 čeká na dokončené zápasy s předzápasovými snímky.'))+'</p>'+
 '<p>'+(core40Finals.length?(en?'CORE 4.0 MAE '+core40Mae.toFixed(3)+' vs baseline '+core40Baseline.toFixed(3)+' on '+core40Finals.length+' same games.':'CORE 4.0 MAE '+core40Mae.toFixed(3)+' proti základnímu modelu '+core40Baseline.toFixed(3)+' na '+core40Finals.length+' stejných zápasech.'):(en?'CORE 4.0 is awaiting completed games.':'CORE 4.0 čeká na dokončené zápasy.'))+' '+(en?'Incomplete factor sets: ':'Neúplné sady faktorů: ')+core40Incomplete+'</p>'+
 '<p>'+(core41Finals.length?(en?'CORE 4.1 MAE '+core41Mae.toFixed(3)+' vs CORE 4.0 '+core40SameMae.toFixed(3)+' on '+core41Finals.length+' identical games.':'CORE 4.1 MAE '+core41Mae.toFixed(3)+' proti CORE 4.0 '+core40SameMae.toFixed(3)+' na '+core41Finals.length+' stejných zápasech.'):(en?'CORE 4.1 is awaiting completed games.':'CORE 4.1 čeká na dokončené zápasy.'))+'</p>'+
 '<p>'+(en?'Special teams: '+changes.length+' of '+special.length+' comparable completed games changed their projected scores. A change does not prove an accuracy improvement.':'Speciální týmy: u '+changes.length+' z '+special.length+' porovnatelných dokončených zápasů se změnila predikce. Změna sama o sobě neznamená vyšší přesnost.')+'</p>'+
 (goalieUnknown?'<p>'+(en?'Goalie data status unknown for ':'Stav brankářských dat není znám u ')+goalieUnknown+(en?' completed games.':' dokončených zápasů.')+'</p>':'');
}
window.addEventListener('banger-engine-lab-archive',render);
window.addEventListener('banger-language-change',render);
function start(){render();setInterval(render,3000)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();