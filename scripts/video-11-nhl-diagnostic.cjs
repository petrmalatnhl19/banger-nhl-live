#!/usr/bin/env node
'use strict';
// VIDEO-11: read-only NHL landing diagnostics. Never downloads media.
const {collect}=require('../video/live-highlights.js');
const id=process.env.NHL_VIDEO_GAME_ID||'2026020335';
if(!/^\d{10}$/.test(id)){console.error('Invalid NHL game ID');process.exitCode=2}
else (async()=>{
 const url='https://api-web.nhle.com/v1/gamecenter/'+id+'/landing';
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:controller.signal});
  if(!response.ok)throw new Error('NHL API returned HTTP '+response.status);
  const data=await response.json();
  const periods=Array.isArray(data?.summary?.scoring)?data.summary.scoring:[];
  const goals=periods.flatMap(p=>Array.isArray(p.goals)?p.goals:[]);
  const clips=collect(id,data);
  const available=clips.filter(c=>c.status==='link-available');
  const missingId=goals.filter(g=>!Number.isSafeInteger(Number(g.eventId??g.eventID))).length;
  const withRawSharingUrl=goals.filter(g=>typeof g.highlightClipSharingUrl==='string'&&g.highlightClipSharingUrl.length>0).length;
  const report={gameId:id,gameState:data.gameState??null,periodCount:periods.length,goalCount:goals.length,goalsMissingEventId:missingId,goalsWithRawSharingUrl:withRawSharingUrl,validOfficialLinks:available.length,pending:clips.length-available.length,invalidOrUnsupportedUrlCount:withRawSharingUrl-available.length,clipIdsPresent:clips.filter(c=>c.clipId!==null).length};
  console.log(JSON.stringify(report,null,2));
  if(!goals.length)console.log('NOTE: no goals found; this is not proof that video links work.');
  if(!available.length)console.log('NOTE: no valid official links in this snapshot; do not claim playback verified.');
  console.log('NOTE: URL presence does not verify browser playback, geographic access or licensing.');
 }catch(e){console.error('NHL video diagnostic failed:',e.message);process.exitCode=1}
 finally{clearTimeout(timeout)}
})();
