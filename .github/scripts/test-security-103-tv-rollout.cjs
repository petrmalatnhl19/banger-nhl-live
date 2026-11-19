"use strict";
const assert=require("node:assert/strict");
const {loadTvData,MODES}=require("../../security/local/security103-tv-rollout.cjs");
(async()=>{
 const archive=[{game_id:101}];
 const legacy={shadow:[{game_id:101,core43_away:7}],preview:[]};
 let oldCalls=0,newCalls=0;
 const fetchLegacy=async()=>{oldCalls++;return legacy;};
 const fetchPublic=async()=>{newCalls++;return [{game_id:101,core43_away:2.2,core42_away:2,
  core42_home:3,core43_home:3.3,core43_preview_away:null,core43_preview_home:null,
  away_gsax_per100:0,home_gsax_per100:null,private_secret:"must not leak"}];};
 const old=await loadTvData({archive,fetchLegacy,fetchPublic});
 assert.equal(old.mode,MODES.LEGACY);
 assert.equal(old.shadow[0].core43_away,7);
 assert.equal(oldCalls,1);assert.equal(newCalls,0);
 const current=await loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,fetchPublic});
 assert.equal(current.shadow[0].core43_away,2.2);
 assert.equal(current.preview[0].away_gsax_per100,0);
 assert.ok(!JSON.stringify(current).includes("must not leak"));
 assert.equal(oldCalls,1);assert.equal(newCalls,1);
 const disabled=await loadTvData({mode:MODES.DISABLED,archive,fetchLegacy,fetchPublic});
 assert.equal(disabled.available,false);
 assert.equal(oldCalls,1);assert.equal(newCalls,1);
 await assert.rejects(loadTvData({mode:"auto",archive,fetchLegacy,fetchPublic}),/unknown/);
 await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,
  fetchPublic:async()=>{throw Error("503 unavailable");}}),/503 unavailable/);
 await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchLegacy,
  fetchPublic:async()=>[{game_id:101,core43_away:"invalid"}]}),/invalid/);
 assert.equal(oldCalls,1,"public failure must not fall back to legacy");
 console.log("PASS SECURITY-103 opt-in modes, public data isolation, fail-closed errors");
})().catch(err=>{console.error(err);process.exitCode=1;});
