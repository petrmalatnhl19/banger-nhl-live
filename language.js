/* BANGER i18n 0.1 — Czech/English interface foundation. No model/data transformations. */
(()=>{'use strict';
const KEY='banger-ui-language';
const translations={
 cs:{'Předpověď':'Předpověď','Přehled zápasu':'Přehled zápasu','Brankáři':'Brankáři','Přesnost':'Přesnost','Podrobný report':'Podrobný report','Přehled':'Přehled','Modely':'Modely','Diagnostika':'Diagnostika','Kalibrace':'Kalibrace','Stabilita':'Stabilita','Největší chyby':'Největší chyby','Vzorce faktorů':'Vzorce faktorů','Kvalita dat':'Kvalita dat','Stav modelů':'Stav modelů','Historie MAE':'Historie MAE','Přínos modelů':'Přínos modelů','Výběr modelu':'Výběr modelu','Gólových modelů':'Gólových modelů','Dokončených zápasů':'Dokončených zápasů','Řídicí centrum predikčních modelů · data, přesnost a vývoj':'Řídicí centrum predikčních modelů · data, přesnost a vývoj'},
 en:{'Předpověď':'Prediction','Přehled zápasu':'Game overview','Brankáři':'Goalies','Přesnost':'Accuracy','Podrobný report':'Detailed report','Přehled':'Overview','Modely':'Models','Diagnostika':'Diagnostics','Kalibrace':'Calibration','Stabilita':'Stability','Největší chyby':'Largest errors','Vzorce faktorů':'Factor patterns','Kvalita dat':'Data quality','Stav modelů':'Model health','Historie MAE':'MAE history','Přínos modelů':'Model uplift','Výběr modelu':'Model selection','Gólových modelů':'Goal models','Dokončených zápasů':'Completed games','Řídicí centrum predikčních modelů · data, přesnost a vývoj':'Prediction model control center · data, accuracy and development'}
};
const dictionary=Object.fromEntries(Object.keys(translations.cs).map(k=>[k,k]));
let lang='cs';try{lang=localStorage.getItem(KEY)==='en'?'en':'cs'}catch{}
function translateText(original){return translations[lang][original]||original}
const labLabels={overview:['🏠 Přehled','🏠 Overview'],models:['🧠 Modely','🧠 Models'],accuracy:['🎯 Přesnost','🎯 Accuracy'],shots:['🏒 Shots','🏒 Shots'],diagnostics:['🔬 Diagnostika','🔬 Diagnostics'],calibration:['🧪 Kalibrace','🧪 Calibration'],stability:['📡 Stabilita','📡 Stability'],errors:['🧩 Největší chyby','🧩 Largest errors'],patterns:['📊 Vzorce faktorů','📊 Factor patterns'],quality:['🛡️ Kvalita dat','🛡️ Data quality'],health:['🩺 Stav modelů','🩺 Model health'],history:['📈 Historie MAE','📈 MAE history'],uplift:['⚖️ Přínos modelů','⚖️ Model uplift'],decision:['🧭 Výběr modelu','🧭 Model selection']};
const jumpLabels=[['🎯 Předpověď','🎯 Prediction'],['📊 Přehled zápasu','📊 Game overview'],['🥅 Brankáři','🥅 Goalies'],['📈 Přesnost','📈 Accuracy'],['📝 Podrobný report','📝 Detailed report']];

// Phase 0.3: translate exact UI labels across game cards, player stats and reports.
// Preserve numbers, team names and free-form analytical text.
const interfaceLabels={
 'VSTUP DO HOKEJOVÉ ARÉNY':'ENTER THE HOCKEY ARENA',
 '📡 STAV PROJEKCÍ SESTAV':'📡 LINEUP PROJECTION STATUS',
 'Aktuální projekce':'Current projections','Archivní sestavy':'Archived lineups',
 'Zjišťuji čas aktualizace…':'Checking update time…',
 '🥅 Brankáři NHL':'🥅 NHL Goalies','Statistiky hráčů':'Player statistics',
 '📅 KALENDÁŘ ZÁPASŮ':'📅 GAME CALENDAR','🏒 Hráči v poli':'🏒 Skaters',
 '🏒 Dnešní zápasy':'🏒 Today’s games','🎯 Analýzy zápasů':'🎯 Game analysis',
 '📈 Pokročilá data':'📈 Advanced data','Domů':'Home',
 'Připojuji se k NHL…':'Connecting to NHL…',
 'ZÁPASŮ':'GAMES','PRÁVĚ ŽIVĚ':'LIVE NOW','DOHRÁNO':'FINAL',
 'Zápasy':'Games','Hráči':'Players','Hráč':'Player','Týmy':'Teams',
 'Zápasy ↓':'Games ↓','Střely ↓':'Shots ↓','✕ Zavřít':'✕ Close',
 'Načítám…':'Loading…','Načítám detail NHL…':'Loading NHL game details…',
 'DETAIL ZÁPASU':'GAME DETAILS','POROVNÁNÍ TÝMŮ':'TEAM COMPARISON',
 'TŘETINY':'PERIODS','ZAČÁTEK · ČR':'START · CZECH TIME','Čas Praha':'Prague time',
 '🏒 Předzápasový přehled':'🏒 Pregame overview',
 '📊 Přehled':'📊 Overview','⚡ Události':'⚡ Events','📝 Komentář':'📝 Commentary',
 '🏒 Hráči':'🏒 Players','Výsledky třetin':'Period scores',
 '📊 Statistiky zápasu':'📊 Game statistics','Střely na branku':'Shots on goal',
 'Načítám další týmové statistiky…':'Loading more team statistics…',
 '⚡ Interaktivní časová osa zápasu':'⚡ Interactive game timeline',
 'Góly, asistence, tresty a střely v chronologickém pořadí.':'Goals, assists, penalties and shots in chronological order.',
 'Načítám události NHL…':'Loading NHL events…',
 '📝 Český online komentář':'📝 Live game commentary',
 'Události podle NHL API. Obnovování každých 30 sekund.':'Events from the NHL API. Refreshes every 30 seconds.',
 '🧩 Předpokládané sestavy':'🧩 Projected lineups',
 'Načítám informace…':'Loading information…',
 '🏒 Statistiky hráčů a brankářů':'🏒 Skater and goalie statistics',
 'Načítám sestavy a statistiky…':'Loading lineups and statistics…',
 '⏱ Vyloučení':'⏱ Penalties','Načítám vyloučení…':'Loading penalties…',
 'Detail není dostupný':'Details unavailable','Nové porovnání':'New comparison',
 'Načítám oficiální údaje NHL…':'Loading official NHL data…',
 '📈 Forma · body v posledních zápasech':'📈 Recent form · points per game',
 'Zleva nejstarší → nejnovější zápas':'Oldest → newest game',
 'Průměrný čas na ledě · sezóna':'Average ice time · season',
 'Body v přesilovce · sezóna':'Power-play points · season',
 'Oficiální NHL API':'Official NHL API','Aktuální sezóna':'Current season',
 'Posledních pět zápasů':'Last five games',
 'Údaje za posledních pět zápasů nejsou dostupné.':'Last five games data unavailable.',
 'Přesilovky':'Power plays','Obrana':'Defense','Útoky':'Forwards',
 'Forma za posledních 5 zápasů':'Form over last five games',
 'Zatím nejsou dostupné záznamy gólů.':'No goal records available yet.',
 'Výsledky třetin zatím nejsou dostupné.':'Period scores are not available yet.',
 'Pro tento den nejsou naplánované zápasy. Zkus jiné datum.':'No games scheduled for this date. Try another day.',
 '🏆 Žebříček přesnosti modelů':'🏆 Model accuracy leaderboard',
 '⚔️ Porovnání hráčů':'⚔️ Player comparison'
};
const originalNodes=new WeakMap();
function translateInterface(){
 const root=document.body;if(!root)return;
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
 const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  const parent=node.parentElement;
  if(!parent||parent.closest('script,style,textarea,option,#bangerLanguageBox'))continue;
  const current=node.nodeValue;
  const trimmed=current.trim();
  let original=originalNodes.get(node);
  if(original===undefined){
   if(!Object.prototype.hasOwnProperty.call(interfaceLabels,trimmed))continue;
   original=trimmed;originalNodes.set(node,original);
  }else if(trimmed!==original&&trimmed!==interfaceLabels[original]){
   if(!Object.prototype.hasOwnProperty.call(interfaceLabels,trimmed)){originalNodes.delete(node);continue;}
   original=trimmed;originalNodes.set(node,original);
  }
  const target=lang==='en'?interfaceLabels[original]:original;
  if(trimmed!==target)node.nodeValue=current.replace(trimmed,target);
 }
}

function apply(){
 document.documentElement.lang=lang;
 translateInterface();
 const en=lang==='en';
 const picker=document.getElementById('bangerLanguageSelect');if(picker&&picker.value!==lang)picker.value=lang;
 document.querySelectorAll('#bangerEngineLab [data-lab-tab]').forEach(el=>{const pair=labLabels[el.dataset.labTab];if(pair){const label=pair[en?1:0];if(el.textContent!==label)el.textContent=label;}});
 document.querySelectorAll('.ux-section-jump [data-ux-jump]').forEach(el=>{const pair=jumpLabels[Number(el.dataset.uxJump)];if(pair){const label=pair[en?1:0];if(el.textContent!==label)el.textContent=label;}});
 document.querySelectorAll('#bangerEngineLab .lab-summary small,#bangerEngineLab .lab-sub').forEach(el=>{
  const original=el.dataset.i18nOriginal||el.textContent.trim();
  if(!dictionary[original])return;
  el.dataset.i18nOriginal=original;
  const label=translateText(original);if(el.textContent!==label)el.textContent=label;
 });
}

function mount(){
 if(document.getElementById('bangerLanguageSelect'))return;
 const box=document.createElement('div');box.id='bangerLanguageBox';
 box.style.cssText='position:fixed;right:12px;bottom:calc(76px + env(safe-area-inset-bottom));z-index:10020;padding:5px 7px;background:#09243bf2;border:1px solid #4abed7;border-radius:12px;box-shadow:0 5px 20px #0008';
 box.innerHTML='<label for="bangerLanguageSelect" style="font:600 11px system-ui;color:#b8eaff;margin-right:5px">🌐</label><select id="bangerLanguageSelect" aria-label="Language / Jazyk" style="background:#102e46;color:#e8faff;border:1px solid #3b7e9a;border-radius:8px;padding:7px;font:600 12px system-ui"><option value="cs">🇨🇿 Čeština</option><option value="en">🇬🇧 English</option></select>';
 document.body.appendChild(box);
 box.querySelector('select').addEventListener('change',e=>{lang=e.target.value==='en'?'en':'cs';try{localStorage.setItem(KEY,lang)}catch{}apply();window.dispatchEvent(new CustomEvent('banger-language-change',{detail:{lang}}))});
 apply();
}
let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
function start(){mount();new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.bangerI18n={getLanguage:()=>lang,t:key=>translateText(key)};
})();
