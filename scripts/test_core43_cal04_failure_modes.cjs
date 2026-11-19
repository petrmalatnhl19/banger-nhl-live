"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {run}=require("./core43_cal04_scheduled_dryrun.cjs");
const now="2026-11-09T22:00:00Z";
async function emptyFetch(_url,opts){assert.equal(opts.method,"GET");return {ok:true,json:async()=>[]};}
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"core43-cal04-"));
 const previous=process.env.CORE43_CAL04_LEDGER_PATH;
 try{
  const ledger=path.join(dir,"ledger.json");
  const base={url:"https://example.supabase.co",key:"test",now,fetchImpl:emptyFetch};
  const first=await run({...base,existingKeys:[]});
  assert.equal(first.checked,0);
  assert.deepEqual(first.ledger.keys,[],"explicit empty history permits an isolated first run");
  process.env.CORE43_CAL04_LEDGER_PATH=ledger;
  const unexpectedRead=async()=>assert.fail("unusable ledger must stop before Supabase reads");
  await assert.rejects(run({...base,fetchImpl:unexpectedRead}),{code:"ENOENT"});
  fs.writeFileSync(ledger,"{broken-json");
  await assert.rejects(run({...base,fetchImpl:unexpectedRead}),SyntaxError,"corrupt JSON must fail closed");
  fs.writeFileSync(ledger,JSON.stringify({schema:"unexpected",keys:[]}));
  await assert.rejects(run(base),/invalid_readonly_ledger/,"unknown schema must fail closed");
  fs.writeFileSync(ledger,JSON.stringify({schema:"core43_cal04_keys_v1",keys:[42]}));
  await assert.rejects(run(base),/invalid_readonly_ledger/,"invalid keys must fail closed");
  fs.writeFileSync(ledger,JSON.stringify({schema:"core43_cal04_keys_v1",keys:["42:dryrun"]}));
  const restored=await run(base);
  assert.deepEqual(restored.ledger.keys,["42:dryrun"]);
  await assert.rejects(run({...base,key:""}),/missing_server_credentials/);
  await assert.rejects(run({...base,fetchImpl:async()=>{throw Error("network_offline")}}),/network_offline/);
  console.log("CORE43-CAL-04 failure-mode regression passed");
 }finally{
  if(previous===undefined)delete process.env.CORE43_CAL04_LEDGER_PATH;
  else process.env.CORE43_CAL04_LEDGER_PATH=previous;
  fs.rmSync(dir,{recursive:true,force:true});
 }
})().catch(e=>{console.error(e);process.exitCode=1});
