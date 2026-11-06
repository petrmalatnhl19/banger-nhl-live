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
function apply(){
 document.documentElement.lang=lang;
 const picker=document.getElementById('bangerLanguageSelect');if(picker&&picker.value!==lang)picker.value=lang;
 document.querySelectorAll('.ux-section-jump button,#bangerEngineLab .lab-controls button,#bangerEngineLab .lab-summary small,#bangerEngineLab .lab-sub').forEach(el=>{
  if(!el.dataset.i18nOriginal){
   const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
   if(!node)return;
   const text=node.textContent.trim();
   const plain=text.replace(/^[^\p{L}\p{N}]+/u,'').trim();
   if(!dictionary[plain])return;
   el.dataset.i18nOriginal=plain;
  }
  const node=[...el.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  if(!node)return;
  const source=el.dataset.i18nOriginal;
  const current=node.textContent;
  const prefix=current.match(/^[^\p{L}\p{N}]*/u)?.[0]||'';
  const next=prefix+translateText(source);
  if(current!==next)node.textContent=next;
 });
}
function mount(){
 if(document.getElementById('bangerLanguageSelect'))return;
 const box=document.createElement('div');box.id='bangerLanguageBox';
 box.style.cssText='position:fixed;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:10020;padding:5px 7px;background:#09243bf2;border:1px solid #4abed7;border-radius:12px;box-shadow:0 5px 20px #0008';
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
