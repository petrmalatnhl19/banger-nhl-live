"use strict";
// SECURITY-110: real HTTP negative-path contract against disposable local PostgREST only.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {loadTvData,MODES}=require("../../security/local/security103-tv-rollout.cjs");
const endpoint="http://127.0.0.1:55433";
const secret="security99_disposable_test_secret_32chars_only";
const columns=["game_id","core42_away","core42_home","core43_away","core43_home",
 "core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"];
function token(role){
 const enc=x=>Buffer.from(JSON.stringify(x)).toString("base64url");
 const signed=enc({alg:"HS256",typ:"JWT"})+"."+enc({role,exp:Math.floor(Date.now()/1000)+300});
 return signed+"."+crypto.createHmac("sha256",secret).update(signed).digest("base64url");
}
async function req(role,path,headers={}){
 const res=await fetch(endpoint+path,{headers:{authorization:"Bearer "+token(role),...headers}});
 return {status:res.status,body:await res.text()};
}
(async()=>{
 for(const role of ["anon","authenticated"]){
  const base=await req(role,"/security101_tv_public_v1?game_id=eq.101");
  assert.equal(base.status,200,role+" baseline");
  const rows=JSON.parse(base.body);
  assert.equal(rows.length,1);
  assert.deepEqual(Object.keys(rows[0]).sort(),[...columns].sort());
  assert.doesNotMatch(base.body,/private starter|never expose|internal_operator_notes|internal_goalie_evidence/);
  const missing=await req(role,"/security101_tv_public_v1?game_id=eq.999");
  assert.equal(missing.status,200);assert.deepEqual(JSON.parse(missing.body),[]);
  const filter=await req(role,"/security101_tv_public_v1?game_id=eq.101&select=game_id,core43_away");
  assert.equal(filter.status,200);assert.deepEqual(JSON.parse(filter.body),[{game_id:101,core43_away:2.2}]);
  for(const field of ["internal_goalie_evidence","internal_operator_notes"]){
   const leak=await req(role,"/security101_tv_public_v1?select="+field);
   assert.ok(leak.status>=400,role+" internal field "+field+" exposed");
   const filterLeak=await req(role,"/security101_tv_public_v1?"+field+"=eq.never%20expose");
   assert.ok(filterLeak.status>=400,role+" internal filter "+field+" exposed");
  }
  const source=await req(role,"/tv_source",{"accept-profile":"security101_private"});
  assert.ok(source.status>=400,role+" private schema exposed");
  let legacy=0;
  const archive=[{game_id:101}];
  const fetchLegacy=async()=>{legacy++;throw Error("forbidden legacy fallback");};
  const ok=await loadTvData({mode:MODES.PUBLIC,archive,fetchPublic:async()=>JSON.parse(base.body),fetchLegacy});
  assert.equal(ok.shadow.length,1);assert.equal(ok.preview.length,1);
  for(const invalid of [null,{},[{game_id:101,core43_away:"bad"}],
    [{game_id:101,core43_away:Infinity}], [{game_id:101},{game_id:101}]]){
   await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,fetchPublic:async()=>invalid,fetchLegacy}));
  }
  await assert.rejects(loadTvData({mode:MODES.PUBLIC,archive,
   fetchPublic:async()=>{throw Error("simulated 503");},fetchLegacy}),/simulated 503/);
  assert.equal(legacy,0,role+" silently fell back to legacy");
  const after=await req(role,"/security101_tv_public_v1?game_id=eq.101");
  assert.equal(after.status,200);assert.deepEqual(JSON.parse(after.body),rows);
 }
 console.log("PASS SECURITY-110 isolated PostgREST: least-data contract, private fields, invalid responses, fail-closed");
})().catch(e=>{console.error(e);process.exitCode=1;});
