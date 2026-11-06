/* BANGER MATCH STORY 2.3 — concise, sourced projected summary */
(()=>{'use strict';
let speaking=null;
const projectionData=new WeakMap();
const style=document.createElement('style');style.textContent='.banger-projection-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:9px;margin:10px 0}.banger-projection-teams{grid-column:1/-1;display:flex;justify-content:space-around;color:#9cecff;font-size:13px}.banger-projection-tile{padding:13px;border:1px solid #3d829b88;border-radius:13px;background:linear-gradient(145deg,#12334d,#091c32)}.banger-projection-label{color:#a6d8eb;font-size:12px}.banger-projection-numbers{display:flex;justify-content:space-around;align-items:center;font-size:24px;font-weight:850;margin:8px 0;color:#f2fbff}.banger-projection-divider{font-size:16px;color:#6a9eb8}.banger-projection-note{font-size:11px;color:#9bbbd0;line-height:1.4}.banger-projection-cards>.analysis-small{grid-column:1/-1}';document.head.appendChild(style);
function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function read(report){
 const body=report.querySelector('.analyst-fold-body');if(!body)return null;
 const h=[...body.querySelectorAll('h4')];
 const get=rx=>{const head=h.find(e=>rx.test(text(e)));return head&&head.nextElementSibling?.tagName==='P'?text(head.nextElementSibling):''};
 const meta=[...body.querySelectorAll('p')].find(e=>/Automatický datový rozbor/.test(text(e)));
 const fixture=text(meta).match(/rozbor\s*·\s*(.*?)\s*·\s*\d{4}/i)?.[1]||'vybraný zápas';
 const verdict=get(/Závěrečný expertní verdikt/i);
 const model=get(/Vážený predikční model/i);
 let snapshot=null;
 try{snapshot=JSON.parse(decodeURIComponent(report.dataset.bangerProjections||''))}catch(e){}
 const fmt=v=>Number.isFinite(v)?v.toLocaleString('cs-CZ',{maximumFractionDigits:1}):null;
 const parts=[];
 parts.push('BANGER PROJECTED. '+fixture.replace(/\\bvs\\b/i,'proti')+'.');
 if(snapshot?.goals&&fmt(snapshot.goals.away)!==null&&fmt(snapshot.goals.home)!==null)
  parts.push('Orientační očekávání gólů: '+snapshot.away+' '+fmt(snapshot.goals.away)+', '+snapshot.home+' '+fmt(snapshot.goals.home)+'. Nejde o přesné konečné skóre.');
 else if(model)parts.push(model.slice(0,220));
 else parts.push('Číselná projekce gólů není dostupná.');
 if(snapshot?.shots&&fmt(snapshot.shots.away)!==null&&fmt(snapshot.shots.home)!==null)
  parts.push('Shots Engine v1 odhaduje: '+snapshot.away+' '+fmt(snapshot.shots.away)+' střel, '+snapshot.home+' '+fmt(snapshot.shots.home)+'. Výpočet kombinuje vlastní střely a střely povolené soupeřem; zatím není kalibrovaný.');
 else parts.push('Střelecký průměr zatím není pro oba týmy dostupný.');
 if(snapshot?.penaltyMinutes&&fmt(snapshot.penaltyMinutes.away)!==null&&fmt(snapshot.penaltyMinutes.home)!==null)
  parts.push('Disciplína v nedávném vzorku: '+snapshot.away+' '+fmt(snapshot.penaltyMinutes.away)+' trestných minut na zápas, '+snapshot.home+' '+fmt(snapshot.penaltyMinutes.home)+'. Počet příštích vyloučení z těchto údajů nelze spolehlivě určit.');
 else parts.push('Projekce počtu vyloučení zatím nemá dostatečné podklady.');
 if(verdict)parts.push(verdict.slice(0,230));
 parts.push('Projektovaní střelci zatím nejsou vyhodnoceni individuálním modelem.');
 return {fixture,parts};
}
function englishStory(data){
 const fmt=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
 const away=String(data?.away||'Away'),home=String(data?.home||'Home');
 const parts=['BANGER PROJECTED. '+away+' vs '+home+'.'];
 if(fmt(data?.goals?.away)!==null&&fmt(data?.goals?.home)!==null)parts.push('Estimated goals: '+away+' '+fmt(data.goals.away)+', '+home+' '+fmt(data.goals.home)+'. This is not an exact final-score prediction.');
 else parts.push('A numeric goal projection is not available for both teams.');
 if(fmt(data?.shots?.away)!==null&&fmt(data?.shots?.home)!==null)parts.push('Shots Engine v1 estimates '+away+' '+fmt(data.shots.away)+' shots and '+home+' '+fmt(data.shots.home)+' shots. The model combines team shooting with opponent shots allowed and has not yet been calibrated.');
 else parts.push('Shot projections are not available for both teams.');
 if(fmt(data?.penaltyMinutes?.away)!==null&&fmt(data?.penaltyMinutes?.home)!==null)parts.push('Recent penalty-minute averages: '+away+' '+fmt(data.penaltyMinutes.away)+', '+home+' '+fmt(data.penaltyMinutes.home)+' per game. These averages cannot reliably predict the number of penalties in the next game.');
 else parts.push('Insufficient evidence for a penalty-count projection.');
 parts.push('Individual goal scorers are not yet evaluated by a validated player-level model.');
 return parts.join(' ');
}
function renderProjectionCards(box){
 const data=projectionData.get(box),visual=box.querySelector('.banger-projection-cards');if(!data||!visual)return;
 const en=window.bangerI18n?.getLanguage?.()==='en';
 const number=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
 const fmt=v=>number(v)===null?'—':number(v).toLocaleString(en?'en-US':'cs-CZ',{maximumFractionDigits:1});
 const clean=v=>String(v||'').replace(/[&<>"']/g,'');
 const tile=(title,left,right,note)=>'<div class="banger-projection-tile"><div class="banger-projection-label">'+title+'</div><div class="banger-projection-numbers"><span>'+fmt(left)+'</span><span class="banger-projection-divider">:</span><span>'+fmt(right)+'</span></div><div class="banger-projection-note">'+note+'</div></div>';
 const sample=Math.min(number(data.sampleGames?.away)||0,number(data.sampleGames?.home)||0);
 const next='<div class="banger-projection-teams"><b>'+clean(data.away||(en?'AWAY':'HOSTÉ'))+'</b><b>'+clean(data.home||(en?'HOME':'DOMÁCÍ'))+'</b></div>'+
 tile(en?'🥅 Expected goals':'🥅 Očekávané góly',data.goals?.away,data.goals?.home,en?'Indicative team model':'Orientační týmový model')+
 tile(en?'🎯 Shots on goal':'🎯 Střely na branku',data.shots?.away,data.shots?.home,en?'Shots Engine v1 · 65% team offense / 35% opponent defense':'Shots Engine v1 · 65 % vlastní útok / 35 % obrana soupeře')+
 tile(en?'⚡ Penalty minutes':'⚡ Trestné minuty',data.penaltyMinutes?.away,data.penaltyMinutes?.home,en?'Historical average · not projected penalties':'Historický průměr · nikoli počet vyloučení')+
 '<p class="analysis-small">'+(en?'The shots model uses team shots and opponent shots allowed, based on at least '+sample+' games per team when data is available. Goal scorers and penalty counts require separate validated models.':'Střelecký model využívá vlastní střely a střely povolené soupeřem ze vzorku nejméně '+sample+' utkání na tým, pokud jsou data dostupná. Střelci a počet vyloučení čekají na samostatný ověřitelný model.')+'</p>';
 if(visual.dataset.renderLanguage!==(en?'en':'cs')){visual.innerHTML=next;visual.dataset.renderLanguage=en?'en':'cs';}
}
function syncStoryLanguage(box){
 renderProjectionCards(box);
 const p=box.querySelector('[data-projected-story]');if(!p)return;
 const en=window.bangerI18n?.getLanguage?.()==='en';
 const target=en?p.dataset.storyEn:p.dataset.storyCs;
 if(target&&p.textContent!==target)p.textContent=target;
}
function install(report){
 if(report.dataset.matchStoryV2)return;report.dataset.matchStoryV2='1';
 const body=report.querySelector('.analyst-fold-body');if(!body)return;
 body.querySelectorAll('.banger-match-story').forEach(el=>el.remove());
 const box=document.createElement('details');box.className='banger-report-section banger-match-story';
 box.innerHTML='<summary>🎙️ BANGER PROJECTED · krátký souhrn</summary><div class="banger-report-section-body"><p data-projected-story></p><button class="btn" type="button" data-projected-play>▶ Přehrát souhrn</button> <button class="btn" type="button" data-projected-stop>⏹ Stop</button><p class="analysis-small" data-projected-status>Hodnoty bez podkladů nejsou odhadovány.</p></div>';
 const visual=document.createElement('div');visual.className='banger-projection-cards';
 let data=null;try{data=JSON.parse(decodeURIComponent(report.dataset.bangerProjections||''))}catch(e){}
 const number=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
 const fmt=v=>number(v)===null?'—':number(v).toLocaleString('cs-CZ',{maximumFractionDigits:1});
 const tile=(title,left,right,note)=>'<div class="banger-projection-tile"><div class="banger-projection-label">'+title+'</div><div class="banger-projection-numbers"><span>'+fmt(left)+'</span><span class="banger-projection-divider">:</span><span>'+fmt(right)+'</span></div><div class="banger-projection-note">'+note+'</div></div>';
 if(data){
  const sample=Math.min(number(data.sampleGames?.away)||0,number(data.sampleGames?.home)||0);
  visual.innerHTML='<div class="banger-projection-teams"><b>'+String(data.away||'HOSTÉ').replace(/[&<>]/g,'')+'</b><b>'+String(data.home||'DOMÁCÍ').replace(/[&<>]/g,'')+'</b></div>'+
   tile('🥅 Očekávané góly',data.goals?.away,data.goals?.home,'Orientační týmový model')+
   tile('🎯 Střely na branku',data.shots?.away,data.shots?.home,'Shots Engine v1 · 65 % vlastní útok / 35 % obrana soupeře')+
   tile('⚡ Trestné minuty',data.penaltyMinutes?.away,data.penaltyMinutes?.home,'Historický průměr · nikoli počet vyloučení')+
   '<p class="analysis-small">Střelecký model využívá vlastní střely a střely povolené soupeřem ze vzorku nejméně '+sample+' utkání na tým, pokud jsou data dostupná. Střelci a počet vyloučení čekají na samostatný ověřitelný model.</p>';
  box.querySelector('.banger-report-section-body').prepend(visual);
  projectionData.set(box,data);
 }
 const result=read(report);const p=box.querySelector('[data-projected-story]');p.dataset.storyCs=result?.parts.join(' ')||'Zatím nejsou dostupná data.';p.dataset.storyEn=englishStory(data);syncStoryLanguage(box);
 body.prepend(box);
 box.addEventListener('click',event=>{
 if(event.target.closest('[data-projected-stop]')){window.speechSynthesis?.cancel();speaking=null;box.querySelector('[data-projected-status]').textContent='Zastaveno';return}
 if(!event.target.closest('[data-projected-play]'))return;
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){box.querySelector('[data-projected-status]').textContent='Hlasové čtení není dostupné.';return}
 window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(p.textContent);utterance.lang=window.bangerI18n?.getLanguage?.()==='en'?'en-US':'cs-CZ';utterance.rate=1.04;utterance.voice=window.speechSynthesis.getVoices().find(v=>v.lang?.toLowerCase()===utterance.lang.toLowerCase())||null;speaking=utterance;utterance.onend=()=>{if(speaking===utterance){speaking=null;box.querySelector('[data-projected-status]').textContent='Dočteno'}};box.querySelector('[data-projected-status]').textContent='Přehrává se';window.speechSynthesis.speak(utterance);
 });
}
function scan(){document.querySelectorAll('.analysis-panel .analyst-expert-report').forEach(install);document.querySelectorAll('.banger-match-story').forEach(syncStoryLanguage)}
window.addEventListener('banger-language-change',()=>{if(speaking){window.speechSynthesis?.cancel();speaking=null;}document.querySelectorAll('.banger-match-story').forEach(syncStoryLanguage)});
function start(){scan();let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan()})}).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();