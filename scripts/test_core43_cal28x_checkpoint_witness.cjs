"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {hashEntry}=require("./core43_cal28w_rotation_history.cjs");
const {verifyWitnessedRotationCheckpoint}=require("./core43_cal28x_checkpoint_witness.cjs");
const authority=generateKeyPairSync("ed25519");
const witnessA=generateKeyPairSync("ed25519"),witnessB=generateKeyPairSync("ed25519");
const anchor={sequence:0,head:"0".repeat(64)},auditorId="independent-auditor";
function rotation(){
 const e={schema:"core43_cal28w_rotation_v1",sequence:1,previousHash:anchor.head,
 auditorId,oldKeyId:"none",newKeyId:"key-001",newFingerprint:"a".repeat(64),action:"bootstrap"};
 e.signature=sign(null,Buffer.from(hashEntry(e),"hex"),authority.privateKey).toString("base64");
 return e;
}
function witness(id,key,head,sequence=1){
 const w={schema:"core43_cal28x_witness_v1",witnessId:id,auditorId,sequence,head};
 w.signature=sign(null,Buffer.from(JSON.stringify(w)),key.privateKey).toString("base64");
 return w;
}
function fixture(){
 const e=rotation(),head=hashEntry(e);
 return {entries:[e],witnesses:[witness("witness-one",witnessA,head),
 witness("witness-two",witnessB,head)],
 keys:{"witness-one":witnessA.publicKey,"witness-two":witnessB.publicKey}};
}
function run(f=fixture(),minimum=2){
 return verifyWitnessedRotationCheckpoint(f.entries,anchor,authority.publicKey,auditorId,
 f.witnesses,f.keys,minimum);
}
test("CAL-28X two synthetic witnesses verify but do not confer trust",()=>{
 const r=run();assert.equal(r.witnessCount,2);assert.equal(r.trusted,false);
 assert.equal(r.checkpointSignaturesValid,true);
});
test("CAL-28X rejects single witness",()=>{
 const f=fixture();f.witnesses.pop();assert.throws(()=>run(f),/invalid_witness_configuration/);
});
test("CAL-28X rejects duplicated witness identity",()=>{
 const f=fixture();f.witnesses[1]=f.witnesses[0];
 assert.throws(()=>run(f),/duplicate_or_invalid_witness/);
});
test("CAL-28X rejects witness signed for a different head",()=>{
 const f=fixture();f.witnesses[1]=witness("witness-two",witnessB,"b".repeat(64));
 assert.throws(()=>run(f),/checkpoint_mismatch/);
});
test("CAL-28X rejects stale witness sequence",()=>{
 const f=fixture();f.witnesses[1]=witness("witness-two",witnessB,hashEntry(f.entries[0]),0);
 assert.throws(()=>run(f),/checkpoint_mismatch/);
});
test("CAL-28X rejects unknown witness",()=>{
 const f=fixture();delete f.keys["witness-two"];
 assert.throws(()=>run(f),/unknown_witness/);
});
test("CAL-28X rejects wrong witness key",()=>{
 const f=fixture();f.keys["witness-two"]=witnessA.publicKey;
 assert.throws(()=>run(f),/witness_signature_invalid/);
});
test("CAL-28X rejects signature tampering",()=>{
 const f=fixture();f.witnesses[0].signature=Buffer.alloc(64).toString("base64");
 assert.throws(()=>run(f),/witness_signature_invalid/);
});
test("CAL-28X rejects injected trusted claim",()=>{
 const f=fixture();f.witnesses[0].trusted=true;
 assert.throws(()=>run(f),/invalid_witness_schema/);
});
test("CAL-28X rejects witness identity equal to auditor",()=>{
 const f=fixture();f.witnesses[0].witnessId=auditorId;
 assert.throws(()=>run(f),/duplicate_or_invalid_witness/);
});
test("CAL-28X rejects forged rotation history",()=>{
 const f=fixture();f.entries[0].newFingerprint="b".repeat(64);
 assert.throws(()=>run(f),/signature_invalid/);
});
test("CAL-28X rejects impossible quorum",()=>{
 assert.throws(()=>run(fixture(),3),/invalid_witness_configuration/);
});
