"use strict";
// SECURITY-114: adversarial, offline tests for the isolated public reader.
// The real TV UI is deliberately not switched over.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {readPublic,DEFAULT_MODE}=require("../../security/local/security113-tv-public-browser.js");
const {loadTvData,MODES}=require("../../security/local/security103-tv-rollout.cjs");
const endpoint="https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/tv_public_predictions_v1";
const apikey="sb_publishable_test";
const archive=[{game_id:101}];
const valid={game_id:101,core42_away:0,core42_home:3,core43_away:2,core43_home:4,core43_preview_away:null,core43_preview_home:1,away_gsax_per100:0,home_gsax_per100:null};
(async()=>{
 assert.equal(DEFAULT_MODE,"legacy");
 let publicCalls=0,legacyCalls=0;
 const fetchLegacy=async()=>{legacyCalls++;return {shadow:[],preview:[]};};
 const fetchPublic=async()=>{publicCalls++;return readPublic({mode:"public",endpoint,apikey,fetchImpl:async()=>({ok:true,json:async()=>[{...valid,secret:"DO_NOT_LEAK"}]})});};
 const legacy=await loadTvData({archive,fetchLegacy,fetchPublic});
 assert.equal(legacy.mode,MODES.LEGACY);
 assert.equal(publicCalls,0);
 const result=await loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,fetchPublic});
 assert.equal(result.shadow[0].core42_away,0);
 assert.equal(result.preview[0].away_gsax_per100,0);
 assert(!JSON.stringify(result).includes("DO_NOT_LEAK"));
 assert.equal(legacyCalls,1);
 assert.equal(publicCalls,1);
 const unavailable=await loadTvData({mode:MODES.DISABLED,archive,fetchLegacy,fetchPublic});
 assert.equal(unavailable.available,false);
 assert.equal(publicCalls,1);
 for(const status of [401,403,429,500,503]){
   await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,fetchPublic:()=>readPublic({mode:"public",endpoint,apikey,fetchImpl:async()=>({ok:false,status})})}),/unavailable/);
 }
 for(const payload of [null,{},[{...valid,core42_away:NaN}],[{...valid,core42_away:Infinity}],[{...valid,core42_away:"2"}],[valid,valid],Array(41).fill(valid)]){
   await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,fetchPublic:()=>readPublic({mode:"public",endpoint,apikey,fetchImpl:async()=>({ok:true,json:async()=>payload})})}),/invalid|duplicate/);
 }
 await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,fetchPublic:()=>readPublic({mode:"public",endpoint,apikey,fetchImpl:async()=>{throw Error("timeout");}})}),/timeout/);
 assert.equal(legacyCalls,1,"public mode must never retry legacy reader");
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 assert(!html.includes("security113-tv-public-browser.js"));
 console.log("PASS SECURITY-114 public reader error isolation, default-off, no legacy fallback");
})().catch(err=>{console.error(err);process.exitCode=1});
