(function(){
'use strict';
let utterance=null,paused=false,segments=[],index=0,activeRoot=null;
const synth=()=>window.speechSynthesis;
const supported=()=>typeof SpeechSynthesisUtterance!=='undefined'&&!!synth();
function reset(){if(supported())synth().cancel();utterance=null;paused=false;segments=[];index=0;update()}
function update(){document.querySelectorAll('[data-banger-voice-status]').forEach(e=>{e.textContent=!utterance?'Připraveno k poslechu':paused?'Pozastaveno':'Přehrává se';});document.querySelectorAll('[data-banger-voice-pause]').forEach(b=>{b.textContent=paused?'▶ Pokračovat':'⏸ Pauza';b.disabled=!utterance});}
function selectVoice(){
 const voices=synth().getVoices();
 const cz=voices.filter(v=>/^cs(?:-|$)/i.test(v.lang||''));
 const male=/male|muž|muz|jan|anton|adam|petr|jakub|ondrej|ondřej|michal|zdenek|zdeněk/i;
 return cz.find(v=>male.test(v.name))||cz.find(v=>v.localService&&male.test(v.name))||cz[0]||null;
}
function spoken(text){
 return text.replace(/\bPROJECTED\b/gi,'předpokládaný start').replace(/\bCONFIRMED\b/gi,'potvrzený start').replace(/\bUNKNOWN\b/gi,'neznámý start')
 .replace(/\bNHL\b/g,'en há el').replace(/\bRotoWire\b/gi,'Rotovajr')
 .replace(/\bvs\.?\b/gi,'proti').replace(/\bPPG\b/g,'bodů na zápas')
 .replace(/\b([0-9]+)\s*%/g,'$1 procent').replace(/\s+/g,' ').trim();
}
function speakNext(){
 if(!segments.length||index>=segments.length){utterance=null;paused=false;update();return}
 const s=synth(),u=new SpeechSynthesisUtterance(segments[index]);utterance=u;
 u.lang='cs-CZ';u.rate=Number(activeRoot?.querySelector('[data-banger-voice-rate]')?.value||0.92);
 u.pitch=0.88;u.voice=selectVoice();
 u.onend=()=>{if(utterance!==u)return;index++;speakNext()};
 u.onerror=()=>{if(utterance!==u)return;utterance=null;update()};
 s.speak(u);update();
}
function start(root){
 if(!supported())return;
 reset();activeRoot=root;
 const report=root.querySelector('.analyst-expert-report .analyst-fold-body');
 if(!report)return;
 // Only narrative h4 + p pairs. Excludes goalie status cards, badges, links and metadata.
 const elements=Array.from(report.children);
 const startAt=elements.findIndex(el=>el.tagName==='H4'&&el.textContent.trim().toLocaleLowerCase('cs-CZ').includes('celkový obraz utkání'));
 const narrative=startAt<0?[]:elements.slice(startAt).filter(el=>el.tagName==='H4'||(el.tagName==='P'&&el.previousElementSibling?.tagName==='H4'));
 segments=[];
 for(const el of narrative){
  const raw=spoken(el.textContent||'');
  if(!raw)continue;
  if(el.tagName==='H4'){segments.push(raw+'.');continue}
  const sentences=raw.match(/[^.!?]+(?:[.!?]+|$)/g)||[raw];
  for(const sentence of sentences){
   const words=sentence.trim().split(/\s+/);let chunk='';
   for(const word of words){if(chunk.length+word.length>200&&chunk){segments.push(chunk.trim());chunk=''}chunk+=word+' '}
   if(chunk.trim())segments.push(chunk.trim());
  }
 }
 index=0;if(segments.length)speakNext();else update();
}
document.addEventListener('click',e=>{const button=e.target.closest('[data-banger-voice]');if(!button)return;const root=button.closest('.analysis-panel');if(!root)return;const action=button.dataset.bangerVoice;if(action==='play')start(root);else if(action==='stop')reset();else if(action==='pause'&&utterance){if(paused){synth().resume();paused=false}else{synth().pause();paused=true}update()}});
const observer=new MutationObserver(()=>{if(activeRoot&&!activeRoot.isConnected)reset();document.querySelectorAll('.analyst-expert-report:not([data-banger-voice-ready])').forEach(report=>{report.dataset.bangerVoiceReady='1';const body=report.querySelector('.analyst-fold-body');if(!body)return;const controls=document.createElement('div');controls.className='banger-voice-controls';controls.style.cssText='display:flex;flex-wrap:wrap;align-items:center;gap:9px;padding:12px;margin:10px 0 18px;border:1px solid #347a9c;border-radius:12px;background:#0b1b35';controls.innerHTML='<button type="button" class="btn" data-banger-voice="play">▶ Přehrát analýzu</button><button type="button" class="btn" data-banger-voice="pause" data-banger-voice-pause disabled>⏸ Pauza</button><button type="button" class="btn" data-banger-voice="stop">⏹ Stop</button><label style="font-size:13px">Rychlost <select data-banger-voice-rate style="background:#112c49;color:white;padding:7px;border-radius:8px"><option value="0.8">0,8×</option><option value="0.92" selected>0,92× · komentátor</option><option value="1">1×</option><option value="1.2">1,2×</option><option value="1.5">1,5×</option></select></label><small data-banger-voice-status style="color:#9db2c6">Připraveno k poslechu</small>';body.prepend(controls);if(!supported()){controls.querySelector('[data-banger-voice="play"]').disabled=true;controls.querySelector('[data-banger-voice-status]').textContent='Tento prohlížeč nepodporuje hlasové čtení.'}})});
observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&utterance&&!paused){synth().pause();paused=true;update()}});
})();