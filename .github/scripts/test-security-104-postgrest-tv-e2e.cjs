"use strict";
// SECURITY-104: disposable PostgREST -> SECURITY-103 rollout -> TV projection integration.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {loadTvData,MODES}=require("../../security/local/security103-tv-rollout.cjs");
const secret="security99_disposable_test_secret_32chars_only";
const endpoint="http://127.0.0.1:55433";
function token(role){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const header=enc({alg:"HS256",typ:"JWT"});
 const payload=enc({role,exp:Math.floor(Date.now()/1000)+300});
 const signing=header+"."+payload;
 return signing+"."+crypto.createHmac("sha256",secret).update(signing).digest("base64url");
}
async function read(role){
 const res=await fetch(endpoint+"/security101_tv_public_v1?game_id=eq.101",{
  headers:{authorization:"Bearer "+token(role),accept:"application/json"}
 });
 if(!res.ok)throw new Error("PostgREST "+res.status);
 return res.json();
}
(async()=>{
 const archive=[{game_id:101,game_date:"2026-11-18",away_team:"AWAY",home_team:"HOME"}];
 for(const role of ["anon","authenticated"]){
  let legacyCalls=0;
  const result=await loadTvData({mode:MODES.PUBLIC,archive,
   fetchPublic:()=>read(role),
   fetchLegacy:async()=>{legacyCalls++;throw new Error("legacy must not run");}
  });
  assert.equal(result.mode,MODES.PUBLIC);
  assert.equal(result.shadow.length,1);
  assert.equal(result.preview.length,1);
  assert.equal(result.shadow[0].game_id,101);
  assert.equal(result.shadow[0].core43_away,2.2);
  assert.equal(result.preview[0].away_gsax_per100,1.5);
  assert.equal(result.preview[0].home_gsax_per100,2.5);
  assert.equal(legacyCalls,0);
  assert.deepEqual(Object.keys(result.shadow[0]).sort(),
   ["game_id","core42_away","core42_home","core43_away","core43_home"].sort());
  assert.deepEqual(Object.keys(result.preview[0]).sort(),
   ["game_id","core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"].sort());
  assert.deepEqual((await loadTvData({mode:MODES.PUBLIC,archive:[{game_id:999}],fetchPublic:()=>read(role)})).shadow,[]);
  await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,
   fetchPublic:async()=>{throw Error("simulated outage");},
   fetchLegacy:async()=>{legacyCalls++;return {shadow:[],preview:[]};}
  }),/simulated outage/);
  assert.equal(legacyCalls,0);
 }
 console.log("PASS SECURITY-104 real PostgREST -> public rollout -> TV projection for both roles");
})().catch(err=>{console.error(err);process.exitCode=1;});
