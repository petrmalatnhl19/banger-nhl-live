'use strict';
// VIDEO-14: read-only live NHL landing -> actual in-app goal link rendering.
// No media download, no automated navigation to third-party video hosts.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const id=process.env.NHL_VIDEO_GAME_ID||'2026020335';
(async()=>{
 assert.match(id,/^\d{10}$/);
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),15000);
 let landing;
 try{
  const response=await fetch('https://api-web.nhle.com/v1/gamecenter/'+id+'/landing',{signal:controller.signal});
  if(!response.ok)throw Error('NHL API HTTP '+response.status);
  landing=await response.json();
 }finally{clearTimeout(timer)}
 const goals=(landing.summary?.scoring||[]).flatMap(p=>p.goals||[]);
 assert.ok(goals.length,'No goals in NHL landing response; cannot verify clips');
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({...devices['Pixel 7'],acceptDownloads:false});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/');
  await page.addScriptTag({path:require('node:path').resolve('video/live-highlights.js')});
  await page.addScriptTag({path:require('node:path').resolve('video/goal-video-map.js')});
  await page.addScriptTag({path:require('node:path').resolve('video/live-highlights-ui.js')});
  const report=await page.evaluate(({id,landing})=>{
   const clips=BangerLiveHighlights.collect(id,landing);
   const mapped=BangerGoalVideoMap.mapGoals(id,landing,clips);
   const root=document.createElement('div');root.id='video14-real';document.body.appendChild(root);
   BangerHighlightsUI.render(root,clips,document);
   const anchors=[...root.querySelectorAll('a')];
   return {goals:mapped.reduce((n,p)=>n+p.goals.length,0),validClips:clips.filter(c=>c.status==='link-available').length,rendered:anchors.length,allOfficial:anchors.every(a=>a.protocol==='https:'&&BangerLiveHighlights.safeUrl(a.href)===a.href&&a.target==='_blank'&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')),firstEventIds:clips.slice(0,3).map(c=>c.eventId)};
  },{id,landing});
  assert.equal(report.goals,goals.length,'Goal count mismatch');
  assert.equal(report.rendered,report.validClips,'Rendered links differ from official metadata');
  assert.equal(report.allOfficial,true,'Unsafe official link markup');
  assert.ok(report.validClips>0,'No official goal video URLs in actual NHL response');
  console.log(JSON.stringify({gameId:id,...report,limitation:'No external video page opened; playback, region restrictions and live publishing latency unverified.'},null,2));
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('VIDEO-14 live integration unavailable or failed:',e.message);process.exitCode=1});
