/* VIDEO-23: official NHL full-game recap links, no media playback. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BangerGameRecaps=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 function safeUrl(value){if(typeof value!=='string')return null;try{const u=new URL(value);return u.protocol==='https:'&&/^(?:[a-z0-9-]+\\.)*nhl\\.com$/i.test(u.hostname)&&u.pathname.startsWith('/video/')?u.href:null}catch{return null}}
 function fromClip(value){if(typeof value==='string'&&/^https:\/\//i.test(value))return safeUrl(value);return null}
 function collect(landing){if(!landing||typeof landing!=='object')return [];const video=landing.summary?.gameVideo||landing.gameVideo||{};const entries=[['recap','▶ Sestřih zápasu',landing.threeMinRecap??video.threeMinRecap],['condensed','▶ Rozšířený sestřih',landing.condensedGame??video.condensedGame]];return entries.flatMap(([kind,label,value])=>{const url=fromClip(value);return url?[{kind,label,url}]:[]})}
 return Object.freeze({collect,safeUrl});
});
