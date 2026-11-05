(function(){
'use strict';
const synth=window.speechSynthesis;
const available=!!synth&&typeof SpeechSynthesisUtterance==='function';
let activeRoot=null, queue=[], position=0, current=null, paused=false, session=0;
const $=(root,selector)=>root?.querySelector(selector);
function status(message){
 document.querySelectorAll('[data-banger-voice-status]').forEach(el=>el.textContent=message);
 document.querySelectorAll('[data-banger-voice-pause]').forEach(el=>{
  el.disabled=!current;el.textContent=paused?'▶ Pokračovat':'⏸ Pauza';
 });
}
function stop(){
 session++;
 if(available)synth.cancel();
 current=null;paused=false;queue=[];position=0;
 status('Připraveno k poslechu');
}
function voice(){
 const voices=synth.getVoices();
 return voices.find(v=>/^cs-CZ$/i.test(v.lang)&&/female|woman|žena|zuzana|vlasta|tereza/i.test(v.name))||
        voices.find(v=>/^cs-CZ$/i.test(v.lang))||
        voices.find(v=>/^cs\b/i.test(v.lang))||null;
}
const teamNames={
 ANA:'Anaheim Ducks',BOS:'Boston Bruins',BUF:'Buffalo Sabres',CAR:'Carolina Hurricanes',
 CBJ:'Columbus Blue Jackets',CGY:'Calgary Flames',CHI:'Chicago Blackhawks',
 COL:'Colorado Avalanche',DAL:'Dallas Stars',DET:'Detroit Red Wings',
 EDM:'Edmonton Oilers',FLA:'Florida Panthers',LAK:'Los Angeles Kings',
 MIN:'Minnesota Wild',MTL:'Montreal Canadiens',NJD:'New Jersey Devils',
 NSH:'Nashville Predators',NYI:'New York Islanders',NYR:'New York Rangers',
 OTT:'Ottawa Senators',PHI:'Philadelphia Flyers',PIT:'Pittsburgh Penguins',
 SEA:'Seattle Kraken',SJS:'San Jose Sharks',STL:'St. Louis Blues',
 TBL:'Tampa Bay Lightning',TOR:'Toronto Maple Leafs',UTA:'Utah Mammoth',
 VAN:'Vancouver Canucks',VGK:'Vegas Golden Knights',WPG:'Winnipeg Jets',
 WSH:'Washington Capitals'
};
function expandTeams(text){
 return text.replace(/\b(?:ANA|BOS|BUF|CAR|CBJ|CGY|CHI|COL|DAL|DET|EDM|FLA|LAK|MIN|MTL|NJD|NSH|NYI|NYR|OTT|PHI|PIT|SEA|SJS|STL|TBL|TOR|UTA|VAN|VGK|WPG|WSH)\b/g,code=>teamNames[code]||code);
}
function expandReportText(report){
 const walker=document.createTreeWalker(report,NodeFilter.SHOW_TEXT);
 const nodes=[];
 while(walker.nextNode())nodes.push(walker.currentNode);
 for(const node of nodes){
  if(node.parentElement?.closest('.banger-voice-controls,script,style'))continue;
  const original=node.nodeValue||'';
  const expanded=expandTeams(original);
  if(expanded!==original)node.nodeValue=expanded;
 }
}
function pronounce(text){
 return expandTeams(text)
  .replace(/\bPROJECTED\b/gi,'předpokládaný start')
  .replace(/\bCONFIRMED\b/gi,'potvrzený start')
  .replace(/\bUNKNOWN\b/gi,'zatím neznámý start')
  .replace(/\bNHL\b/g,'en há el')
  .replace(/\bRotoWire\b/gi,'Rotovajr')
  .replace(/\bvs\.?\s/gi,'proti ')
  .replace(/\bPPG\b/g,'bodů na zápas')
  .replace(/(\d)\s*%/g,'$1 procent')
  .replace(/(\d)\s*:\s*(\d)/g,'$1 ku $2')
  .replace(/\s+/g,' ').trim();
}
function collect(root){
 const body=$(root,'.analyst-expert-report .analyst-fold-body');
 if(!body)return [];
 const elements=Array.from(body.children);
 // The report now has additional narrative sections before "Celkový obraz utkání".
 // Read all narrative h4/p pairs in their visible order, excluding goalie cards and metadata.
 const first=elements.findIndex(el=>el.tagName==='H4');
 if(first<0)return [];
 const result=[];
 for(let i=first;i<elements.length;i++){
  const el=elements[i];
  if(el.tagName!=='H4'&&!(el.tagName==='P'&&el.previousElementSibling?.tagName==='H4'))continue;
  const value=pronounce(el.textContent||'');
  if(!value)continue;
  if(el.tagName==='H4'){
   result.push({text:value.replace(/[.:!?]+$/,'')+'.',kind:'heading'});
  }else{
   // Keep decimals and abbreviations intact. Split only at sentence-ending punctuation.
   const sentences=value.match(/.*?(?:[!?]+|[.](?=\s+[A-ZÁ-Ž]|$)|$)/g)?.map(s=>s.trim()).filter(Boolean)||[value];
   for(const sentence of sentences){
    if(sentence.length<=280){result.push({text:sentence,kind:'sentence'});continue}
    let chunk='';
    for(const word of sentence.split(/\s+/)){
     if(chunk&&chunk.length+word.length+1>260){result.push({text:chunk.trim(),kind:'sentence'});chunk=''}
     chunk+=(chunk?' ':'')+word;
    }
    if(chunk)result.push({text:chunk,kind:'sentence'});
   }
  }
 }
 return result;
}
function next(token){
 if(token!==session)return;
 if(position>=queue.length){current=null;paused=false;status('Analýza dočtena');return}
 const item=queue[position++];
 const u=new SpeechSynthesisUtterance(item.text);
 current=u;u.lang='cs-CZ';u.voice=voice();
 const base=Number($(activeRoot,'[data-banger-voice-rate]')?.value||1.02);
 u.rate=Math.min(1.5,Math.max(0.75,base*(item.kind==='heading'?0.94:1)));
 u.pitch=1.04;
 u.onend=()=>{if(current!==u||token!==session)return;current=null;next(token)};
 u.onerror=e=>{if(current!==u||token!==session)return;current=null;if(e.error==='canceled'||e.error==='interrupted')return;next(token)};
 synth.speak(u);
 status('Přehrává se česká analýza');
}
function play(root){
 if(!available)return;
 stop();activeRoot=root;queue=collect(root);position=0;
 if(!queue.length){status('Text analýzy zatím není dostupný');return}
 next(session);
}
document.addEventListener('click',event=>{
 const button=event.target.closest('[data-banger-voice]');
 if(!button)return;
 const root=button.closest('.analysis-panel');
 if(!root)return;
 const action=button.dataset.bangerVoice;
 if(action==='play')play(root);
 if(action==='stop')stop();
 if(action==='pause'&&current){
  if(paused){synth.resume();paused=false;status('Přehrává se česká analýza')}
  else{synth.pause();paused=true;status('Pozastaveno')}
 }
});
const observer=new MutationObserver(()=>{
 if(activeRoot&&!activeRoot.isConnected)stop();
 document.querySelectorAll('.analyst-expert-report:not([data-banger-voice-ready])').forEach(report=>{
  report.dataset.bangerVoiceReady='1';
  expandReportText(report);
  const body=report.querySelector('.analyst-fold-body');
  if(!body)return;
  const bar=document.createElement('div');
  bar.className='banger-voice-controls';
  bar.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:12px;margin:10px 0 18px;border:1px solid #347a9c;border-radius:12px;background:#0b1b35';
  bar.innerHTML='<button type="button" class="btn" data-banger-voice="play">▶ Poslechnout analýzu</button><button type="button" class="btn" data-banger-voice="pause" data-banger-voice-pause disabled>⏸ Pauza</button><button type="button" class="btn" data-banger-voice="stop">⏹ Stop</button><label style="font-size:13px">Tempo <select data-banger-voice-rate style="background:#112c49;color:white;padding:7px;border-radius:8px"><option value="0.9">Klidné · 0,9×</option><option value="1.02" selected>Plynulé · 1,02×</option><option value="1.12">Svižné · 1,12×</option><option value="1.25">Rychlé · 1,25×</option></select></label><small data-banger-voice-status style="color:#9db2c6">Připraveno k poslechu</small>';
  body.prepend(bar);
  if(!available){bar.querySelector('[data-banger-voice="play"]').disabled=true;bar.querySelector('[data-banger-voice-status]').textContent='Hlasové čtení není v prohlížeči dostupné'}
 });
});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&current&&!paused){synth.pause();paused=true;status('Pozastaveno')}});
})();