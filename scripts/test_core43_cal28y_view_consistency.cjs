"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {hashEntry}=require("./core43_cal28w_rotation_history.cjs");
const {verifyCheckpointViewConsistency}=require("./core43_cal28y_view_consistency.cjs");
const authority=generateKeyPairSync("ed25519");
const keys={one:generateKeyPairSync("ed25519"),two:generateKeyPairSync("ed25519"),three:generateKeyPairSync("ed25519")};
const auditorId="independent-auditor",anchor={sequence:0,head:"0".repeat(64)};
function rotation(fingerprint="a".repeat(64)){
 const e={schema:"core43_cal28w_rotation_v1",sequence:1,previousHash:anchor.head,auditorId,
 oldKeyId:"none",newKeyId:"key-001",newFingerprint:fingerprint,action:"bootstrap"};
 e.signature=sign(null,Buffer.from(hashEntry(e),"hex"),authority.privateKey).toString("base64");
 return e;
}
function witness(id,e){
 const w={schema:"core43_cal28x_witness_v1",witnessId:id,auditorId,sequence:1,head:hashEntry(e)};
 w.signature=sign(null,Buffer.from(JSON.stringify(w)),keys[id].privateKey).toString("base64");
 return w;
}
function view(observerId,e,ids){
 return {observerId,anchor,entries:[e],witnesses:ids.map(id=>witness(id,e))};
}
function fixture(){
 const e=rotation(),left=view("observer-left",e,["one","two"]),
 right=view("observer-right",e,["two","three"]);
 const publicKeys=Object.fromEntries(Object.entries(keys).map(([id,k])=>[id,k.publicKey]));
 return {left,right,publicKeys};
}
function run(f){return verifyCheckpointViewConsistency(f.left,f.right,authority.publicKey,auditorId,f.publicKeys);}
test("CAL-28Y consistent synthetic views remain untrusted",()=>{
 const r=run(fixture());assert.equal(r.viewsConsistent,true);assert.equal(r.trusted,false);
});
test("CAL-28Y detects validly signed conflicting histories",()=>{
 const f=fixture(),e=rotation("b".repeat(64));
 f.right=view("observer-right",e,["two","three"]);
 assert.throws(()=>run(f),/conflicting_checkpoint_heads/);
});
test("CAL-28Y rejects identical observer identity",()=>{
 const f=fixture();f.right.observerId=f.left.observerId;
 assert.throws(()=>run(f),/distinct_observers_required/);
});
test("CAL-28Y rejects identical witness set without additional witness",()=>{
 const f=fixture();f.right=view("observer-right",f.left.entries[0],["one","two"]);
 assert.throws(()=>run(f),/no_independent_witness_overlap/);
});
test("CAL-28Y rejects invalid witness signature",()=>{
 const f=fixture();f.right.witnesses[1].signature=Buffer.alloc(64).toString("base64");
 assert.throws(()=>run(f),/witness_signature_invalid/);
});
test("CAL-28Y rejects unsigned history tampering",()=>{
 const f=fixture();f.right.entries[0].newFingerprint="b".repeat(64);
 assert.throws(()=>run(f),/signature_invalid/);
});
test("CAL-28Y rejects unknown witness",()=>{
 const f=fixture();delete f.publicKeys.three;
 assert.throws(()=>run(f),/unknown_witness/);
});
test("CAL-28Y rejects extra trust fields",()=>{
 const f=fixture();f.left.trusted=true;
 assert.throws(()=>run(f),/invalid_view_schema/);
});
test("CAL-28Y rejects different sequences without consistency proof",()=>{
 const f=fixture();const e=f.right.entries[0],next={
 schema:"core43_cal28w_rotation_v1",sequence:2,previousHash:hashEntry(e),auditorId,
 oldKeyId:"key-001",newKeyId:"key-002",newFingerprint:"b".repeat(64),action:"rotate"};
 next.signature=sign(null,Buffer.from(hashEntry(next),"hex"),authority.privateKey).toString("base64");
 f.right.entries.push(next);
 for(const id of ["two","three"]){
 const w={schema:"core43_cal28x_witness_v1",witnessId:id,auditorId,sequence:2,head:hashEntry(next)};
 w.signature=sign(null,Buffer.from(JSON.stringify(w)),keys[id].privateKey).toString("base64");
 f.right.witnesses[f.right.witnesses.findIndex(x=>x.witnessId===id)]=w;
 }
 assert.throws(()=>run(f),/different_sequence_requires_consistency_proof/);
});
