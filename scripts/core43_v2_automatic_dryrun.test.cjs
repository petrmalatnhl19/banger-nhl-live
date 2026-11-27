"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {run}=require("./core43_v2_automatic_dryrun.cjs");
const {VERSION,hashRecord}=require("./core43_json_canonicalization.cjs");
const now="2026-11-27T19:00:00Z";
test("ready V2 capture is verified but never persisted",async()=>{
 const record={serializationVersion:VERSION,gameId:"123",nested:{z:1,a:2}};
 let inspected=0;
 const result=await run({key:"test",url:"https://example.supabase.co",now,
  monitorImpl:async()=>({results:[{gameId:"123",awayTeam:"DAL",homeTeam:"MIN",ready:true}]}),
  inspectImpl:async()=>{inspected++;return {captured:true,record,sha256:hashRecord(record)};}});
 assert.equal(inspected,1);
 assert.equal(result.ready,1);
 assert.equal(result.archived,0);
 assert.equal(result.writesEnabled,false);
 assert.equal(result.games[0].sha256,hashRecord(record));
});
test("unready game does not attempt a capture",async()=>{
 const result=await run({key:"test",now,
  monitorImpl:async()=>({results:[{gameId:"456",ready:false,reason:"missing_baseline"}]}),
  inspectImpl:async()=>{throw Error("must_not_run");}});
 assert.equal(result.ready,0);
 assert.equal(result.games[0].reason,"missing_baseline");
});
test("rejects mismatched digest and legacy V1",async()=>{
 for(const record of [{serializationVersion:VERSION,gameId:"1"},{gameId:"1"}]){
  await assert.rejects(run({key:"test",now,
   monitorImpl:async()=>({results:[{gameId:"1",ready:true}]}),
   inspectImpl:async()=>({captured:true,record,sha256:"bad"})}),/v2_integrity_mismatch/);
 }
});
