"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {hashEntry}=require("./core43_cal28w_rotation_history.cjs");
const {verifyAppendOnlyCheckpointViews}=require("./core43_cal28z_consistency_proof.cjs");
const authority=generateKeyPairSync("ed25519");
const keys={one:generateKeyPairSync("ed25519"),two:generateKeyPairSync("ed25519"),three:generateKeyPairSync("ed25519")};
const auditorId="independent-auditor",anchor={sequence:0,head:"0".repeat(64)};
const publicKeys=Object.fromEntries(Object.entries(keys).map(([id,k])=>[id,k.publicKey]));
function rotation(sequence,previousHash,oldKeyId,newKeyId,action,fingerprint){
 const e={schema:"core43_cal28w_rotation_v1",sequence,previousHash,auditorId,
 oldKeyId,newKeyId,newFingerprint:fingerprint,action};
 e.signature=sign(null,Buffer.from(hashEntry(e),"hex"),authority.privateKey).toString("base64");
 return e;
}
function witness(id,entries){
 const w={schema:"core43_cal28x_witness_v1",witnessId:id,auditorId,
 sequence:entries.length,head:hashEntry(entries[entries.length-1])};
 w.signature=sign(null,Buffer.from(JSON.stringify(w)),keys[id].privateKey).toString("base64");
 return w;
}
function view(observerId,entries,ids){
 return {observerId,anchor,entries,witnesses:ids.map(id=>witness(id,entries))};
}
function fixture(){
 const first=rotation(1,anchor.head,"none","key-001","bootstrap","a".repeat(64));
 const second=rotation(2,hashEntry(first),"key-001","key-002","rotate","b".repeat(64));
 return {older:view("observer-old",[first],["one","two"]),
 newer:view("observer-new",[first,second],["two","three"])};
}
function run(f){return verifyAppendOnlyCheckpointViews(f.older,f.newer,authority.publicKey,auditorId,publicKeys);}
test("CAL-28Z verifies signed extension but never claims external trust",()=>{
 const r=run(fixture());assert.equal(r.appendOnlyVerified,true);assert.equal(r.trusted,false);
 assert.equal(r.oldSequence,1);assert.equal(r.newSequence,2);
});
test("CAL-28Z rejects different signed prefix",()=>{
 const f=fixture(),replacement=rotation(1,anchor.head,"none","key-001","bootstrap","c".repeat(64));
 const next=rotation(2,hashEntry(replacement),"key-001","key-002","rotate","b".repeat(64));
 f.newer=view("observer-new",[replacement,next],["two","three"]);
 assert.throws(()=>run(f),/history_prefix_mismatch/);
});
test("CAL-28Z rejects stale shorter new view",()=>{
 const f=fixture();f.newer=view("observer-new",f.older.entries,["two","three"]);
 assert.throws(()=>run(f),/strict_extension_required/);
});
test("CAL-28Z rejects different genesis",()=>{
 const f=fixture();f.newer.anchor={sequence:0,head:"f".repeat(64)};
 assert.throws(()=>run(f),/history_rollback_or_fork/);
});
test("CAL-28Z rejects forged new entry",()=>{
 const f=fixture();f.newer.entries[1].newFingerprint="c".repeat(64);
 assert.throws(()=>run(f),/signature_invalid/);
});
test("CAL-28Z rejects unknown witness",()=>{
 const f=fixture();f.newer.witnesses[1].witnessId="unknown";
 assert.throws(()=>run(f),/unknown_witness/);
});
test("CAL-28Z rejects same observer",()=>{
 const f=fixture();f.newer.observerId=f.older.observerId;
 assert.throws(()=>run(f),/distinct_observers_required/);
});
test("CAL-28Z rejects injected trusted field",()=>{
 const f=fixture();f.older.trusted=true;
 assert.throws(()=>run(f),/invalid_view_schema/);
});
test("CAL-28Z requires extra witness on newer checkpoint",()=>{
 const f=fixture();f.newer=view("observer-new",f.newer.entries,["one","two"]);
 assert.throws(()=>run(f),/no_additional_witness/);
});
test("CAL-28Z rejects forged witness signature",()=>{
 const f=fixture();f.newer.witnesses[1].signature=Buffer.alloc(64).toString("base64");
 assert.throws(()=>run(f),/witness_signature_invalid/);
});
