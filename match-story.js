/* BANGER MATCH STORY — short spoken pregame preview, no new predictions */
(()=>{'use strict';
const team={UTA:'Utah Mammoth',MTL:'Montreal Canadiens',DAL:'Dallas Stars'};
let active=null;
function words(t){return String(t||'').replace(/\b(UTA|MTL|DAL)\b/g,m=>team[m]||m).replace(/\bvs\.?\b/gi,'proti').replace(/\bNHL\b/g,'en há el').replace(/(\d)\s*%/g,'$1 procent').replace(/\s+/g,' ').trim()}
function story(report){
 const body=report.querySelector('.analyst-fold-body');if(!body)return '';
 const meta=Array.from(body.querySelectorAll('p')).find(p=>/Automatický datový rozbor/.test(p.textContent));
 const match=meta?.textContent.match(/rozbor\s*[·:]\s*(.*?)\s*[·:]\s*\d{4}-\d{2}-\d{2}/i);
 const names=match?match[1].split(/\s+vs\s+/i):[];
 const heads=Array.from(body.querySelectorAll('h4'));
 const pick=rx=>{const h=heads.find(h=>rx.test(h.textContent));const p=h?.nextElementSibling;return p?.tagName==='P'?p.textContent.trim():''};
 const verdict=pick(/Závěrečný expertní verdikt/i);
 const model=pick(/Vážený predikční model/i);
 const rest=pick(/forma|tempo|speciální týmy|přesilov|brankář/i);
 let lines=['Vítejte u předzápasového komentáře BANGER NHL LIVE.'];
 if(names.length===2)lines.push('Podíváme se na to, jak by mohl vypadat zápas '+words(names[0])+' proti '+words(names[1])+'.');
 if(verdict)lines.push(words(verdict));else lines.push('Pro tento zápas zatím nemáme dost podkladů pro jednoznačný závěr.');
 if(model)lines.push(words(model));
 if(rest)lines.push(words(rest));
 lines.push('Jde o možný scénář podle dostupných dat, nikoli o jistý výsledek. Rozhodnout mohou brankáři, speciální týmy a aktuální forma.');
 return lines.join(' ').slice(0,2600);
}
function install(report){
 if(report.dataset.matchStory)return;report.dataset.matchStory='1';
 const body=report.querySelector('.analyst-fold-body');if(!body)return;
 const panel=document.createElement('details');panel.className='banger-report-section banger-match-story';
 panel.innerHTML='<summary>🎙️ Jak by mohl zápas probíhat</summary><div class="banger-report-section-body"><p data-story-text></p><button type="button" class="btn" data-story-play>▶ Přehrát komentář</button> <button type="button" class="btn" data-story-stop>⏹ Stop</button><p class="analysis-small" data-story-status>Krátký předzápasový komentář z dostupných dat.</p></div>';
 const text=story(report);panel.querySelector('[data-story-text]').textContent=text;
 body.prepend(panel);
 panel.addEventListener('click',e=>{
 if(e.target.closest('[data-story-stop]')){speechSynthesis?.cancel();active=null;panel.querySelector('[data-story-status]').textContent='Zastaveno';return}
 if(!e.target.closest('[data-story-play]'))return;
 if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){panel.querySelector('[data-story-status]').textContent='České hlasové čtení není v prohlížeči dostupné.';return}
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(story(report));u.lang='cs-CZ';u.rate=1;const voices=speechSynthesis.getVoices();u.voice=voices.find(v=>/^cs-CZ$/i.test(v.lang))||null;active=u;u.onend=()=>{if(active===u){active=null;panel.querySelector('[data-story-status]').textContent='Komentář dočten'}};panel.querySelector('[data-story-status]').textContent='Přehrává se komentář';speechSynthesis.speak(u);
 });
}
function scan(){document.querySelectorAll('.analysis-panel .analyst-expert-report').forEach(install)}
function start(){scan();let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;scan()})}).observe(document.body,{subtree:true,childList:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();