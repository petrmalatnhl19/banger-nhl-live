'use strict';
// VIDEO-13: Android-sized Chromium smoke for official NHL goal links.
// Deterministic fixture; does NOT claim remote video playback works.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({...devices['Pixel 7'],acceptDownloads:false});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/');
  await page.addScriptTag({path:path.resolve('video/live-highlights.js')});
  await page.addScriptTag({path:path.resolve('video/goal-video-map.js')});
  await page.addScriptTag({path:path.resolve('video/live-highlights-ui.js')});
  const report=await page.evaluate(()=>{
   const id=2026020335;
   const landing={summary:{scoring:[{goals:[
    {eventId:10,highlightClip:12,highlightClipSharingUrl:'https://www.nhl.com/video/official-goal-test'},
    {eventId:11},
    {eventId:12,highlightClipSharingUrl:'https://nhl.com.evil.example/watch'}
   ]}]}};
   const clips=BangerLiveHighlights.collect(id,landing);
   const mapped=BangerGoalVideoMap.mapGoals(id,landing,clips);
   const root=document.createElement('div');root.id='video13-fixture';document.body.appendChild(root);
   BangerHighlightsUI.render(root,clips,document);
   return {count:clips.length,mappedValid:!!mapped[0].goals[0].video,mappedPending:mapped[0].goals[1].video===null,mappedUnsafe:mapped[0].goals[2].video===null};
  });
  assert.equal(report.count,3);
  assert.equal(report.mappedValid,true);
  assert.equal(report.mappedPending,true);
  assert.equal(report.mappedUnsafe,true);
  const root=page.locator('#video13-fixture');
  const anchors=root.locator('a');
  assert.equal(await anchors.count(),1,'Only the official NHL URL should render');
  const anchor=anchors.first();
  assert.equal(await anchor.getAttribute('href'),'https://www.nhl.com/video/official-goal-test');
  assert.equal(await anchor.getAttribute('target'),'_blank');
  const rel=await anchor.getAttribute('rel');
  assert.match(rel,/noopener/);assert.match(rel,/noreferrer/);
  assert.equal(await anchor.isVisible(),true);
  console.log('VIDEO-13 mobile Chromium: valid official link visible, missing and unsafe links suppressed, safe external navigation attributes verified.');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
