"use strict";
// SECURITY-108: isolated Chromium regression for CURRENT TV Match Stats.
// Network is entirely mocked. This does NOT test the future production API.
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {chromium}=require("playwright");
const script=readFileSync("scripts/banger_tv_match_stats.js","utf8");
const archive=[{game_id:101,game_date:"2026-11-18",away_team:"DAL",home_team:"BOS",
 core41_away:2,core41_home:3,core42_away:2.25,core42_home:3.25}];
const shadow=[{game_id:101,core43_away:1.25,core43_home:2.5}];
const preview=[{game_id:101,core43_preview_away:2.75,core43_preview_home:3.5,
 away_gsax_per100:1.5,home_gsax_per100:2.25}];
async function scenario(mode){
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({serviceWorkers:"block"});
  const paths=[];
  await context.route("**/*",async route=>{
   const url=new URL(route.request().url());
   if(url.origin==="http://fixture.test"&&url.pathname==="/")
    return route.fulfill({contentType:"text/html",body:'<div id="banger-prediction-hub"></div>'});
   const headers={"access-control-allow-origin":"*","access-control-allow-headers":"*"};
   if(route.request().method()==="OPTIONS")return route.fulfill({status:204,headers});
   if(url.pathname.startsWith("/rest/v1/")){
    const name=url.pathname.split("/").at(-1);paths.push(name);
    if(name==="nhl_prediction_archive")return route.fulfill({json:mode==="empty"?[]:archive,headers});
    if(name==="core43_shadow_predictions_v1"||name==="core43_shadow_preview_v1"){
     if(mode==="denied")return route.fulfill({status:403,json:{code:"42501"},headers});
     const rows=name==="core43_shadow_predictions_v1"?shadow:preview;
     return route.fulfill({json:mode==="missing"?[]:rows,headers});
    }
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
  if(mode==="empty"){
   await page.getByText("Žádné neodehrané zápasy v archivu.").waitFor();
   assert.equal(await page.locator("#banger-tv-table table").count(),0);
  }else{
   const table=page.locator("#banger-tv-table");
   await table.getByText("CORE 4.2 · góly",{exact:true}).waitFor();
   const cells=async label=>{
    const row=table.getByRole("row").filter({has:page.getByText(label,{exact:true})});
    const values=await row.getByRole("cell").allTextContents();
    return [values[0],values[2]];
   };
   assert.deepEqual(await cells("CORE 4.2 · góly"),["2,25","3,25"]);
   const visible=mode==="normal";
   assert.deepEqual(await cells("CORE 4.3 · ověřený"),visible?["1,25","2,50"]:["—","—"]);
   assert.deepEqual(await cells("CORE 4.3 · náhled"),visible?["2,75","3,50"]:["—","—"]);
   assert.deepEqual(await cells("GSAx / 100 · vstup"),visible?["1,50","2,25"]:["—","—"]);
   assert.equal(await table.locator("select option").count(),1);
  }
  assert.deepEqual(errors,[]);
  assert.ok(paths.includes("nhl_prediction_archive"));
  if(mode!=="empty")assert.ok(paths.includes("core43_shadow_predictions_v1"));
 }finally{await browser.close();}
}
(async()=>{
 for(const mode of ["normal","denied","missing","empty"])await scenario(mode);
 console.log("PASS SECURITY-108 isolated Chromium TV rendering: normal, denied, missing, empty");
})().catch(e=>{console.error(e);process.exitCode=1;});
