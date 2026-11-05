/* BANGER MATCH STORY 2.0 — concise, sourced projected summary */
(()=>{'use strict';
let speaking=null;
function text(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
function read(report){
 const body=report.querySelector('.analyst-fold-body');if(!body)return null;
 const h=[...body.querySelectorAll('h4')];
 const get=rx=>{const head=h.find(e=>rx.test(text(e)));return head&&head.nextElementSibling?.tagName==='P'?text(head.nextElementSibling):''};
 const meta=[...body.querySelectorAll('p')].find(e=>/Automatický datový rozbor/.test(text(e)));
 const fixture=text(meta).match(/rozbor\s*·\s*(.*?)\s*·\s*\d{4}/i)?.[1]||'vybraný zápas';
 const verdict=get(/Závěrečný expertní verdikt/i);
 const model=get(/Vážený predikční model/i);
 const expected=model.match(/(?:očekávání|očekávané góly)[^\d]{0,80}(\d+[.,]\d+)[^\d]{1,80}(\d+[.,]\d+)/i);
 const parts=[];
 parts.push('BANGER PROJECTED. '+fixture.replace(/\bvs\b/i,'proti')+'.');
 if(expected)parts.push('Model očekává přibližně '+expected[1]+' a '+expected[2]+' gólu. Nejde o jisté konečné skóre.');
 else if(model)parts.push(model.slice(0,280));
 else parts.push('Číselná projekce výsledku není dostupná.');
 if(verdict)parts.push(verdict.slice(0,300));
 parts.push('Projektovaní střelci: zatím bez ověřené individuální pravděpodobnosti gólu.');
 parts.push('Počet střel: číselná projekce zatím není vypočítaná.');
 parts.push('Počet vyloučení a přesilovek: číselná projekce zatím není vypočítaná.');
 return {fixture,parts};
}
function install(report){
 if(report.dataset.matchStoryV2)return;report.dataset.matchStoryV2='1';
 const body=report.querySelector('.analyst-fold-body');if(!body)return;
 body.querySelectorAll('.banger-match-story').forEach(el=>el.remove());
 const box=document.createElement('details');box.className='banger-report-section banger-match-story';
 box.innerHTML='<summary>🎙️ BANGER PROJECTED · krátký souhrn</summary><div class="banger-report-section-body"><p data-projected-story></p><button class="btn" type="button" data-projected-play>▶ Přehrát souhrn</button> <button class="btn" type="button" data-projected-stop>⏹ Stop</button><p class="analysis-small" data-projected-status>Hodnoty bez podkladů nejsou odhadovány.</p></div>';
 const result=read(report);const p=box.querySelector('[data-projected-story]');p.textContent=result?.parts.join(' ')||'Zatím nejsou dostupná data.';
 body.prepend(box);
 box.addEventListener('click',event=>{
 if(event.target.closest('[data-projected-stop]')){window.speechSynthesis?.cancel();speaking=null;box.querySelector('[data-projected-status]').textContent='Zastaveno';return}
 if(!event.target.closest('[data-projected-play]'))return;
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){box.querySelector('[data-projected-status]').textContent='Hlasové čtení není dostupné.';return}
 window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(p.textContent);utterance.lang='cs-CZ';utterance.rate=1.04;utterance.voice=window.speechSynthesis.getVoices().find(v=>/^cs-CZ$/i.test(v.lang))||null;speaking=utterance;utterance.onend=()=>{if(speaking===utterance){speaking=null;box.querySelector('[data-projected-status]').textContent='Dočteno'}};box.querySelector('[data-projected-status]').textContent='Přehrává se';window.speechSynthesis.speak(utterance);
 });
}
function scan(){document.querySelectorAll('.analysis-panel .analyst-expert-report').forEach(install)}
function start(){scan();let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan()})}).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();