/* VIDEO-24: official NHL recap links, no video embedding or media extraction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BangerGameRecaps=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 const HOST='www.nhl.com';
 function safeUrl(value){
  if(typeof value!=='string'||!value.trim())return null;
  try{
   const raw=value.trim();
   // NHL scoreboard commonly returns a site-relative /video/... path.
   if(!raw.startsWith('/video/')&&!raw.startsWith('https://'))return null;
   const u=new URL(raw,'https://'+HOST);
   if(u.protocol!=='https:'||!['nhl.com',HOST].includes(u.hostname.toLowerCase())||!u.pathname.startsWith('/video/'))return null;
   if(u.username||u.password)return null;
   return u.href;
  }catch{return null}
 }
 function collect(landing){
  if(!landing||typeof landing!=='object')return [];
  const video=landing.summary?.gameVideo||landing.gameVideo||{};
  const entries=[['recap','▶ Sestřih zápasu',landing.threeMinRecap??video.threeMinRecap],['condensed','▶ Rozšířený sestřih',landing.condensedGame??video.condensedGame]];
  return entries.flatMap(([kind,label,value])=>{const url=safeUrl(value);return url?[{kind,label,url}]:[]});
 }
 return Object.freeze({collect,safeUrl});
});
