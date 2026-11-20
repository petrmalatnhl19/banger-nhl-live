/* VIDEO-03: pure metadata adapter; does not fetch or play video. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.BangerLiveHighlights=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  function safeUrl(value){
    if(typeof value!=='string') return null;
    try {
      const url=new URL(value);
      if(url.protocol!=='https:') return null;
      if(!/^(?:[a-z0-9-]+\.)*(?:nhl\.com|nhle\.com)$/.test(url.hostname.toLowerCase())) return null;
      return url.href;
    } catch { return null; }
  }
  function collect(gameId,landing){
    if(!/^\d{10}$/.test(String(gameId))||!landing||typeof landing!=='object') return [];
    const goals=Array.isArray(landing.summary?.scoring)?landing.summary.scoring.flatMap(p=>Array.isArray(p.goals)?p.goals:[]):[];
    const seen=new Set();
    return goals.flatMap(goal=>{
      const eventId=goal.eventId??goal.eventID;
      if(!Number.isSafeInteger(Number(eventId))||Number(eventId)<0) return [];
      const key=String(gameId)+':'+String(eventId);
      if(seen.has(key)) return [];
      seen.add(key);
      const clipId=goal.highlightClip;
      const url=safeUrl(goal.highlightClipSharingUrl);
      return [{gameId:String(gameId),eventId:Number(eventId),clipId:typeof clipId==='number'||typeof clipId==='string'?String(clipId):null,officialUrl:url,status:url?'link-available':'pending'}];
    });
  }
  return Object.freeze({collect,safeUrl});
});
