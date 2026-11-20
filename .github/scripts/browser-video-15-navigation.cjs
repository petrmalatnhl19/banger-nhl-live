'use strict';
// VIDEO-15: Pixel-sized browser navigation and recovery, using intercepted NHL page.
// This verifies UI navigation only, not real NHL playback or geographic availability.
const {chromium,devices}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({...devices['Pixel 7'],acceptDownloads:false});
  await context.route('https://www.nhl.com/video/video15-navigation-test',route=>
   route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Official NHL navigation fixture</title><p id="fixture">Offline test page</p>'}));
  const page=await context.newPage();
  await page.goto('http://127.0.0.1:8765/');
  for(const script of ['video/live-highlights.js','video/live-highlights-ui.js'])
   await page.addScriptTag({path:path.resolve(script)});
  await page.evaluate(()=>{
   const root=document.createElement('section');
   root.id='video15-match';
   root.innerHTML='<h2>Edmonton – Florida</h2><p id="match-state">Goal details remain available</p>';
   document.body.appendChild(root);
   BangerHighlightsUI.render(root,[
    {eventId:208,status:'link-available',officialUrl:'https://www.nhl.com/video/video15-navigation-test'},
    {eventId:402,status:'pending',officialUrl:null},
    {eventId:620,status:'link-available',officialUrl:'https://nhl.com.evil.example/clip'}
   ],document);
  });
  const links=page.locator('#video15-match a');
  assert.equal(await links.count(),1,'Missing and untrusted clips must not be clickable');
  assert.equal(await links.first().getAttribute('target'),'_blank');
  const popupPromise=context.waitForEvent('page');
  await links.first().click();
  const popup=await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  assert.equal(new URL(popup.url()).hostname,'www.nhl.com');
  assert.equal(await popup.locator('#fixture').textContent(),'Offline test page');
  assert.equal(await popup.evaluate(()=>window.opener),null,'Video tab must not have opener access');
  assert.equal(await page.locator('#video15-match a').count(),1,'Original match must remain intact');
  await popup.close();
  await page.bringToFront();
  assert.equal(await page.locator('#video15-match a').count(),1,'Returning from clip must preserve goal link');
  assert.equal(await page.locator('#video15-match').isVisible(),true);
  console.log('VIDEO-15 passed: mobile link opens isolated NHL tab, closes, returns to preserved match; missing and unsafe links suppressed. External page mocked; real playback not tested.');
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error('VIDEO-15 failed:',e);process.exitCode=1});
