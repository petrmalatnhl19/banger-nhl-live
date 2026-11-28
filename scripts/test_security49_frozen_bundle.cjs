"use strict";
/* SECURITY-49: same frozen input hash for every coefficient; tamper/replay rejection.
 * Offline synthetic fixture; real existing experimental calculation function.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const coefficients=Object.freeze([0,0.005,0.02,0.03]);
function canonical(v){
  if(Array.isArray(v))return "["+v.map(canonical).join(",")+"]";
  if(v&&typeof v==="object")return "{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}";
  return JSON.stringify(v);
}
const hash=v=>crypto.createHash("sha256").update(canonical(v)).digest("hex");
const fixture={
  gameId:"synthetic-security49",cutoff:"2026-11-16T19:00:00Z",kickoff:"2026-11-16T20:00:00Z",
  status:"scheduled",baseline:{away:2.8,home:3.2,predictedAt:"2026-11-16T18:00:00Z"},
  awayGoalie:{id:"A",available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:"2026-11-16T18:30:00Z"}},
  homeGoalie:{id:"B",available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:"2026-11-16T18:40:00Z"}},
  evidence:[{id:"source-1",publishedAt:"2026-11-16T18:20:00Z",verifiedAt:"2026-11-16T18:25:00Z",ingestedAt:"2026-11-16T18:26:00Z"}]
};
function validBundle(b){
  const cutoff=Date.parse(b.cutoff),start=Date.parse(b.kickoff);
  if(!b.gameId||b.status!=="scheduled"||!Number.isFinite(cutoff)||!Number.isFinite(start)||cutoff>=start)return false;
  if(!b.baseline||!Number.isFinite(Date.parse(b.baseline.predictedAt))||Date.parse(b.baseline.predictedAt)>cutoff)return false;
  if(!Array.isArray(b.evidence)||b.evidence.length===0)return false;
  if(b.evidence.some(e=>!e.id||["publishedAt","verifiedAt","ingestedAt"].some(k=>!Number.isFinite(Date.parse(e[k]))||Date.parse(e[k])>cutoff)))return false;
  if(!b.awayGoalie||!b.homeGoalie||!b.awayGoalie.id||!b.homeGoalie.id||b.awayGoalie.id===b.homeGoalie.id)return false;
  return [b.awayGoalie,b.homeGoalie].every(g=>g.available&&g.value&&Number.isFinite(Date.parse(g.value.fetchedAt))&&Date.parse(g.value.fetchedAt)<=cutoff);
}
function makeRecords(bundle){
  if(!validBundle(bundle))throw Error("invalid_frozen_bundle");
  const frozen=structuredClone(bundle),inputHash=hash(frozen);
  const records=coefficients.map(coefficient=>{
    const result=calculateShadow({baseline:frozen.baseline,awayGoalie:frozen.awayGoalie,homeGoalie:frozen.homeGoalie,asOf:frozen.cutoff,coefficient});
    if(!result.available)throw Error("engine_rejected_"+result.reason);
    const payload={schema:"security49_offline_v1",gameId:frozen.gameId,cutoff:frozen.cutoff,
      coefficient,inputSha256:inputHash,engine:result.model,
      expectedAwayGoals:result.expectedAwayGoals,expectedHomeGoals:result.expectedHomeGoals,
      calibrated:false,production:false,persistable:false};
    return {payload,sha256:hash(payload)};
  });
  return {frozen,inputSha256:inputHash,records};
}
function verify(bundle){
  if(!bundle||!validBundle(bundle.frozen)||hash(bundle.frozen)!==bundle.inputSha256||
      !Array.isArray(bundle.records)||bundle.records.length!==coefficients.length)return false;
  const expected=makeRecords(bundle.frozen);
  return expected.inputSha256===bundle.inputSha256&&bundle.records.every((record,i)=>
    record.payload.inputSha256===bundle.inputSha256&&
    record.payload.coefficient===coefficients[i]&&
    record.sha256===hash(record.payload)&&
    record.sha256===expected.records[i].sha256);
}
const before=canonical(fixture),snapshot=makeRecords(fixture);
assert.equal(verify(snapshot),true);
assert.equal(canonical(fixture),before,"must not mutate original inputs");
assert.equal(new Set(snapshot.records.map(x=>x.payload.inputSha256)).size,1);
assert.equal(new Set(snapshot.records.map(x=>x.sha256)).size,4);
assert.deepEqual(makeRecords(fixture),snapshot,"replay must be deterministic");
assert(snapshot.records.every(r=>r.payload.production===false&&r.payload.persistable===false));
const swapped=structuredClone(snapshot);
[swapped.records[0],swapped.records[1]]=[swapped.records[1],swapped.records[0]];
assert.equal(verify(swapped),false,"swapped coefficient must fail");
const modifiedInput=structuredClone(snapshot);
modifiedInput.frozen.homeGoalie.value.gsaxPer100Shots=3;
assert.equal(verify(modifiedInput),false,"tampered input must fail");
const modifiedOutput=structuredClone(snapshot);
modifiedOutput.records[2].payload.expectedAwayGoals+=0.01;
assert.equal(verify(modifiedOutput),false,"tampered output must fail");
const modifiedHash=structuredClone(snapshot);
modifiedHash.records[1].payload.inputSha256="0".repeat(64);
modifiedHash.records[1].sha256=hash(modifiedHash.records[1].payload);
assert.equal(verify(modifiedHash),false,"one variant using another input hash must fail");
const modifiedGame=structuredClone(snapshot);
modifiedGame.records[3].payload.gameId="wrong-game";
modifiedGame.records[3].sha256=hash(modifiedGame.records[3].payload);
assert.equal(verify(modifiedGame),false,"cross-game replay must fail");
const missing=structuredClone(snapshot);missing.records.pop();
assert.equal(verify(missing),false,"missing coefficient must fail");
const late=structuredClone(fixture);
late.evidence[0].verifiedAt="2026-11-16T19:01:00Z";
assert.throws(()=>makeRecords(late),/invalid_frozen_bundle/);
const afterStart=structuredClone(fixture);
afterStart.kickoff="2026-11-16T18:59:00Z";
assert.throws(()=>makeRecords(afterStart),/invalid_frozen_bundle/);
console.log("PASS SECURITY-49 frozen input binding and four-variant integrity (offline)");
