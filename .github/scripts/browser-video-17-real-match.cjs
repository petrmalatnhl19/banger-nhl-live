'use strict';
// VIDEO-17: exercise the actual BANGER match modal with NHL landing-shaped data.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({...devices['Pixel 7']});
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/');
  await page.waitForFunction(()=>Boolean(window.BangerLiveHighlights&&window.BangerGoalVideoMap));
  const report=await page.evaluate(async()=>{
   const gameId='2026020335';
   const fixture={gameState:'OFF',awayTeam:{abbrev:'EDM',score:3},homeTeam:{abbrev:'FLA',score:4},summary:{scoring:[{periodDescriptor:{number:1},goals:[
    {eventId:208,name:{default:'Test goal 1'},teamAbbrev:'EDM',timeInPeriod:'02:10',highlightClip:111,highlightClipSharingUrl:'https://www.nhl.com/video/video17-real-modal-test'},
    {eventId:402,name:{default:'Test goal 2'},teamAbbrev:'FLA',timeInPeriod:'04:20'},
    {eventId:620,name:{default:'Test goal 3'},teamAbbrev:'FLA',timeInPeriod:'07:30',highlightClipSharingUrl:'https://nhl.com.evil.example/watch'}
   ]}]}};
   const originalGet=get;
   get=async url=>url.includes('/landing')?fixture:{};
   const trigger=document.createElement('button');document.body.appendChild(trigger);
   try{
    await detail(gameId,trigger);
    const pane=document.querySelector('[data-match-pane="goals"]');
    const links=[...pane.querySelectorAll('.goal-video-link a')];
    const before={goalRows:pane.querySelectorAll('.goal-event').length,links:links.length,href:links[0]?.href,target:links[0]?.target,rel:links[0]?.rel,missingLinks:pane.querySelectorAll('.goal-video-link').length};
    return before;
   }finally{get=originalGet}
  });
  assert.equal(report.goalRows,3);
  assert.equal(report.links,1,'Only valid official video should appear in real match modal');
  assert.equal(report.href,'https://www.nhl.com/video/video17-real-modal-test');
  assert.equal(report.target,'_blank');
  assert.match(report.rel,/noopener/);
  assert.match(report.rel,/noreferrer/);
  // Mobile layout hides secondary tabs behind the More menu. Navigate as a user.
  const goalsTab=page.locator('[data-match-tab="goals"]');
  assert.equal(await goalsTab.count(),1,'Goals tab should exist');
  if(!await goalsTab.isVisible()){
   const more=page.locator('#matchMoreToggle');
   assert.equal(await more.isVisible(),true,'Mobile More button should be visible');
   await more.click();
  }
  await goalsTab.click();
  assert.equal(await page.locator('[data-match-pane="goals"]').isVisible(),true,'Goals pane should be visible after mobile navigation');
  assert.equal(await page.locator('[data-match-pane="goals"] .goal-video-link a').count(),1);
  console.log('VIDEO-17 passed: actual match modal renders 3 goals, 1 official safe video link; missing/unsafe clips are hidden.');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('VIDEO-17 failed:',e);process.exitCode=1});
