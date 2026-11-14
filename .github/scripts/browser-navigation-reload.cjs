"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
const BASE="http://127.0.0.1:8765/";
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  const response=await page.goto(BASE,{waitUntil:"domcontentloaded",timeout:30000});
  assert(response&&response.ok(),"application must load");
  await page.waitForFunction(()=>window.history.state?.bangerTab==="dashboard",{timeout:15000});
  const state=()=>page.evaluate(()=>({tab:history.state?.bangerTab,ui:S.tab,modal:history.state?.bangerModal,href:location.href}));
  const select=async(id,tab)=>{
   await page.evaluate(id=>document.getElementById(id).click(),id);
   await page.waitForFunction(t=>history.state?.bangerTab===t,tab,{timeout:10000});
   assert.equal((await state()).ui,tab,"visible application tab must match history");
  };
  await select("tabSkaters","skaters");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>history.state?.bangerTab==="skaters"&&S.tab==="skaters",{timeout:15000});
  await select("tabGames","games");
  await page.reload({waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>history.state?.bangerTab==="games"&&S.tab==="games",{timeout:15000});
  await page.goBack({waitUntil:"domcontentloaded",timeout:15000});
  await page.waitForFunction(()=>history.state?.bangerTab==="skaters"&&S.tab==="skaters",{timeout:15000});
  await page.goBack({waitUntil:"domcontentloaded",timeout:15000});
  await page.waitForFunction(()=>history.state?.bangerTab==="dashboard"&&S.tab==="dashboard",{timeout:15000});
  assert.equal(errors.length,0,"browser JavaScript errors: "+errors.join(" | "));
  console.log("STAB-04.3 Chromium mobile reload and Back integration passed",await state());
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
