"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 try{
  const response=await page.goto("http://127.0.0.1:8765/",{waitUntil:"domcontentloaded",timeout:30000});
  assert(response?.ok(),"application must load before disconnect");
  await page.waitForFunction(()=>history.state?.bangerTab==="dashboard",{timeout:15000});
  await context.setOffline(true);
  for(const [tab,id] of [["games","games"],["skaters","skaters"],["news","news"]]){
   await page.locator('#uxMobileNav [data-ux-tab="'+tab+'"]').click();
   await page.waitForFunction(t=>S.tab===t&&history.state?.bangerTab===t,tab,{timeout:5000});
   assert.match(await page.locator("#status").innerText(),/Offline/);
   assert.match(await page.locator("#content").innerText(),/Jste offline/);
   assert.equal(await page.locator('#uxMobileNav [data-ux-tab="'+tab+'"]').getAttribute("aria-current"),"page");
  }
  await context.setOffline(false);
  await page.waitForFunction(()=>S.tab==="news"&&!document.getElementById("status").textContent.startsWith("Offline ·"),null,{timeout:15000});
  assert.equal(await page.evaluate(()=>history.state.bangerTab),"news");
  console.log("STAB-05.1 offline navigation and reconnect browser regression passed");
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
