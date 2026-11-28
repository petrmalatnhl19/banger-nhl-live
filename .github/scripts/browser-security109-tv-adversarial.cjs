"use strict";
// SECURITY-109: browser-only adversarial fixtures. No live API or production changes.
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {chromium}=require("playwright");
const script=readFileSync("scripts/banger_tv_match_stats.js","utf8");
async function run(mode){
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({serviceWorkers:"block"});
  await context.route("**/*",async route=>{
   const url=new URL(route.request().url());
   if(url.origin==="http://fixture.test"&&url.pathname==="/")
    return route.fulfill({contentType:"text/html",body:'<div id="banger-prediction-hub"></div>'});
   const headers={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
   if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
   if(url.pathname.startsWith("/rest/v1/")){
    const name=url.pathname.split("/").at(-1);
    if(name==="nhl_prediction_archive"){
     if(mode==="archive-error")return route.fulfill({status:500,json:{message:"private_database_password=SECRET"},headers});
     if(mode==="malformed")return route.fulfill({body:"not-json",headers});
     return route.fulfill({json:[{game_id:101,game_date:"2026-11-18",
      away_team:'<img src=x onerror="window.__injected=1">',home_team:"BOS",
      core42_away:2.25,core42_home:3.25}],headers});
    }
    if(name==="core43_shadow_predictions_v1")
     return route.fulfill({json:[{game_id:101,core43_away:"not-a-number",core43_home:null}],headers});
    if(name==="core43_shadow_preview_v1")
     return route.fulfill({json:[{game_id:101,core43_preview_away:0,core43_preview_home:null,
      away_gsax_per100:"Infinity",home_gsax_per100:null}],headers});
   }
   if(url.pathname.startsWith("/v1/club-schedule-season/"))
    return route.fulfill({json:{games:[]},headers});
   return route.abort();
  });
  const page=await context.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://fixture.test/");
  await page.addScriptTag({content:script});
  await page.locator("#banger-tv-stats summary").click();
  const status=page.locator("#banger-tv-status");
  if(mode==="archive-error"||mode==="malformed"){
   await status.getByText("Načtení TV statistik se nepodařilo. Zkuste to později.").waitFor();
   assert.doesNotMatch(await status.textContent(),/SECRET|password|HTTP 500|not-json/);
  }else{
   const table=page.locator("#banger-tv-table");
   await table.getByText("CORE 4.2 · góly",{exact:true}).waitFor();
   assert.equal(await page.locator("#banger-tv-stats img").count(),0);
   assert.equal(await page.evaluate(()=>window.__injected),undefined);
   assert.ok((await table.textContent()).includes("<img src=x"));
   const values=async label=>{
    const row=table.getByRole("row").filter({has:page.getByText(label,{exact:true})});
    const cells=await row.getByRole("cell").allTextContents();
    return [cells[0],cells[2]];
   };
   assert.deepEqual(await values("CORE 4.3 · ověřený"),["—","—"]);
   assert.deepEqual(await values("CORE 4.3 · náhled"),["0,00","—"]);
   assert.deepEqual(await values("GSAx / 100 · vstup"),["—","—"]);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
}
(async()=>{
 for(const mode of ["invalid-values","archive-error","malformed"])await run(mode);
 console.log("PASS SECURITY-109 adversarial TV data, HTML escaping, generic errors");
})().catch(e=>{console.error(e);process.exitCode=1;});
