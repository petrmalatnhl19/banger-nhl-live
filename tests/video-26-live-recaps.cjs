// VIDEO-26: live integration probe. Run: node tests/video-26-live-recaps.cjs
const assert=require('node:assert/strict');
const {collect}=require('../video/game-recaps.js');
const gameId=process.env.NHL_RECAP_GAME_ID||'2025021043';
const date=process.env.NHL_RECAP_DATE||'2026-03-14';
const timeout=Number(process.env.NHL_RECAP_TIMEOUT_MS||12000);
async function json(url){const r=await fetch(url,{signal:AbortSignal.timeout(timeout),headers:{accept:'application/json'}});if(!r.ok)throw Error('NHL API '+r.status+' '+url);return r.json()}
(async()=>{
 assert.match(date,/^\d{4}-\d{2}-\d{2}$/);assert.match(gameId,/^\d{10}$/);
 const score=await json('https://api-web.nhle.com/v1/score/'+date);
 const game=(score.games||[]).find(g=>String(g.id)===gameId);
 assert.ok(game,'Requested game missing from NHL score feed');
 const clips=collect(game);
 assert.ok(clips.length>0,'No official NHL recap links returned for this game');
 for(const clip of clips){assert.match(clip.url,/^https:\/\/(?:www\.)?nhl\.com\/video\//);const r=await fetch(clip.url,{method:'GET',redirect:'follow',signal:AbortSignal.timeout(timeout),headers:{accept:'text/html'}});assert.ok(r.ok,'NHL video page returned '+r.status);assert.ok(new URL(r.url).hostname.endsWith('nhl.com'),'Video redirected outside NHL domain');console.log(clip.kind,clip.url,r.status)}
 console.log('PASS NHL game recap live integration',gameId,date,clips.length);
})().catch(e=>{console.error('FAIL NHL recap live integration:',e.message);process.exitCode=1});
