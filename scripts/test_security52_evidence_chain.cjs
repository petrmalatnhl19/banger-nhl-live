"use strict";
/* SECURITY-52: offline end-to-end evidence chain with real experimental calculator.
 * Synthetic publisher/witness keys and data; no production writes.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
const hash=v=>crypto.createHash("sha256").update(canonical(v)).digest("hex");
const sign=(v,key)=>crypto.sign(null,Buffer.from(canonical(v)),key).toString("base64");
const check=(v,sig,key)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),key,Buffer.from(sig,"base64"));}catch{return false;}};
const publisher=crypto.generateKeyPairSync("ed25519"),witness=crypto.generateKeyPairSync("ed25519");
const cutoff="2026-11-16T19:00:00Z";
const input={gameId:"synthetic-52",status:"scheduled",cutoff,kickoff:"2026-11-16T20:00:00Z",
 baseline:{away:2.8,home:3.2,predictedAt:"2026-11-16T18:00:00Z"},
 awayGoalie:{id:"A",available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:"2026-11-16T18:30:00Z"}},
 homeGoalie:{id:"B",available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:"2026-11-16T18:40:00Z"}}};
const coefficients=[0,0.005,0.02,0.03];
function prepare(data=input,observedAt="2026-11-16T18:45:00Z"){
 const source={schema:"security52_source_v1",gameId:data.gameId,cutoff:data.cutoff,
   input:structuredClone(data),claimedPublishedAt:"2026-11-16T18:42:00Z"};
 const publisherSignature=sign(source,publisher.privateKey);
 const witnessRecord={schema:"security52_witness_v1",sourceHash:hash(source),
   publisherSignatureHash:hash(publisherSignature),observedAt};
 return {source,publisherSignature,witnessRecord,witnessSignature:sign(witnessRecord,witness.privateKey)};
}
function validate(receipt){
 const s=receipt?.source,w=receipt?.witnessRecord;
 if(!s||!w||!receipt.publisherSignature||!receipt.witnessSignature)throw Error("missing_evidence");
 const d=s.input,at=Date.parse(s.cutoff);
 if(s.schema!=="security52_source_v1"||w.schema!=="security52_witness_v1"||
   !d||s.gameId!==d.gameId||s.cutoff!==d.cutoff||d.status!=="scheduled"||
   !Number.isFinite(at)||!Number.isFinite(Date.parse(d.kickoff))||Date.parse(d.kickoff)<=at)
   throw Error("invalid_game_or_cutoff");
 const times=[s.claimedPublishedAt,w.observedAt,d.baseline?.predictedAt,
   d.awayGoalie?.value?.fetchedAt,d.homeGoalie?.value?.fetchedAt];
 if(times.some(t=>typeof t!=="string"||!Number.isFinite(Date.parse(t))||Date.parse(t)>at)||
   Date.parse(s.claimedPublishedAt)>Date.parse(w.observedAt))throw Error("late_or_invalid_evidence");
 if(!d.awayGoalie?.id||!d.homeGoalie?.id||d.awayGoalie.id===d.homeGoalie.id||
   !d.awayGoalie.available||!d.homeGoalie.available)throw Error("invalid_goalies");
 if(w.sourceHash!==hash(s)||w.publisherSignatureHash!==hash(receipt.publisherSignature)||
   !check(s,receipt.publisherSignature,publisher.publicKey)||
   !check(w,receipt.witnessSignature,witness.publicKey))throw Error("invalid_signature_or_chain");
 return structuredClone(d);
}
function produce(receipt){
 const frozen=validate(receipt),inputHash=hash(frozen);
 const evidenceHash=hash({source:receipt.source,publisherSignature:receipt.publisherSignature,
   witnessRecord:receipt.witnessRecord,witnessSignature:receipt.witnessSignature});
 const records=coefficients.map(coefficient=>{
   const result=calculateShadow({baseline:frozen.baseline,awayGoalie:frozen.awayGoalie,
     homeGoalie:frozen.homeGoalie,asOf:frozen.cutoff,coefficient});
   if(!result.available)throw Error("experimental_engine_rejected");
   const payload={schema:"security52_prediction_v1",gameId:frozen.gameId,cutoff:frozen.cutoff,
     coefficient,inputHash,evidenceHash,engine:result.model,
     away:result.expectedAwayGoals,home:result.expectedHomeGoals,
     calibrated:false,production:false,persistable:false};
   return {payload,sha256:hash(payload)};
 });
 const archive={schema:"security52_offline_archive_v1",frozen,receipt:structuredClone(receipt),
   inputHash,evidenceHash,records,production:false,writeEnabled:false};
 return {...archive,archiveHash:hash(archive)};
}
function verifyArchive(a){
 try{
   const {archiveHash,...body}=a;
   if(archiveHash!==hash(body)||body.production!==false||body.writeEnabled!==false)return false;
   return canonical(produce(body.receipt))===canonical(a);
 }catch{return false;}
}
const good=prepare(),archive=produce(good);
assert.equal(verifyArchive(archive),true);
assert.deepEqual(produce(good),archive,"deterministic replay");
assert.equal(new Set(archive.records.map(r=>r.payload.inputHash)).size,1);
assert.equal(new Set(archive.records.map(r=>r.payload.evidenceHash)).size,1);
assert.equal(new Set(archive.records.map(r=>r.sha256)).size,4);
const tamper=structuredClone(archive);tamper.records[1].payload.home+=0.1;
assert.equal(verifyArchive(tamper),false);
const changedInput=structuredClone(good);changedInput.source.input.homeGoalie.value.gsaxPer100Shots=12;
assert.throws(()=>produce(changedInput),/invalid_signature_or_chain/);
const late=prepare(input,"2026-11-16T19:01:00Z");
assert.throws(()=>produce(late),/late_or_invalid_evidence/);
const live=prepare({...input,status:"live"});
assert.throws(()=>produce(live),/invalid_game_or_cutoff/);
const missing=structuredClone(good);delete missing.witnessSignature;
assert.throws(()=>produce(missing),/missing_evidence/);
const forged=structuredClone(good);forged.witnessSignature=sign(forged.witnessRecord,publisher.privateKey);
assert.throws(()=>produce(forged),/invalid_signature_or_chain/);
const swapped=structuredClone(archive);[swapped.records[0],swapped.records[1]]=[swapped.records[1],swapped.records[0]];
assert.equal(verifyArchive(swapped),false);
assert.equal(archive.production,false);
console.log("PASS SECURITY-52 offline end-to-end evidence to four predictions and archive verification");
