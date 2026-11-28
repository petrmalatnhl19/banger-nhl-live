"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {generateKeyPairSync,sign}=require("node:crypto");
const {hashEntry,verifyRotationHistory}=require("./core43_cal28w_rotation_history.cjs");
const keys=generateKeyPairSync("ed25519"), genesis="0".repeat(64);
const checkpoint={sequence:0,head:genesis};
function entry(sequence,previousHash,oldKeyId,newKeyId,action) {
 const e={schema:"core43_cal28w_rotation_v1",sequence,previousHash,
 auditorId:"independent-auditor",oldKeyId,newKeyId,newFingerprint:"a".repeat(64),action};
 e.signature=sign(null,Buffer.from(hashEntry(e),"hex"),keys.privateKey).toString("base64");
 return e;
}
function chain() {
 const a=entry(1,genesis,"none","key-001","bootstrap");
 const b=entry(2,hashEntry(a),"key-001","key-002","rotate");
 return [a,b];
}
function run(entries=chain(),anchor=checkpoint,key=keys.publicKey) {
 return verifyRotationHistory(entries,anchor,key,"independent-auditor");
}
test("CAL-28W verifies synthetic chain but never asserts real trust",()=>{
 const r=run();assert.equal(r.activeKeyId,"key-002");assert.equal(r.sequence,2);
 assert.equal(r.signatureChainValid,true);assert.equal(r.trusted,false);
});
test("CAL-28W rejects rollback to stale checkpoint",()=>{
 assert.throws(()=>run(chain(),{sequence:1,head:"b".repeat(64)}),/history_rollback_or_fork/);
});
test("CAL-28W rejects deleted first event",()=>{
 assert.throws(()=>run(chain().slice(1)),/history_rollback_or_fork/);
});
test("CAL-28W rejects forged predecessor",()=>{
 const c=chain();c[1].previousHash="b".repeat(64);
 assert.throws(()=>run(c),/history_rollback_or_fork/);
});
test("CAL-28W rejects unsigned key substitution",()=>{
 const c=chain();c[1].newFingerprint="b".repeat(64);
 assert.throws(()=>run(c),/signature_invalid/);
});
test("CAL-28W rejects wrong authority key",()=>{
 const other=generateKeyPairSync("ed25519");
 assert.throws(()=>run(chain(),checkpoint,other.publicKey),/signature_invalid/);
});
test("CAL-28W rejects non-current predecessor key",()=>{
 const c=chain();c[1].oldKeyId="key-999";
 assert.throws(()=>run(c),/unauthorized_rotation/);
});
test("CAL-28W rejects reused key ID",()=>{
 const c=chain();c[1].newKeyId="key-001";
 assert.throws(()=>run(c),/reused_or_invalid_key/);
});
test("CAL-28W rejects unauthorized action",()=>{
 const c=chain();c[1].action="replace";
 assert.throws(()=>run(c),/invalid_action/);
});
test("CAL-28W rejects injected trusted claim",()=>{
 const c=chain();c[0].trusted=true;
 assert.throws(()=>run(c),/invalid_entry_schema/);
});
test("CAL-28W rejects duplicate sequence",()=>{
 const c=chain();c[1].sequence=1;
 assert.throws(()=>run(c),/history_rollback_or_fork/);
});
test("CAL-28W rejects invalid anchor",()=>{
 assert.throws(()=>run(chain(),{sequence:0,head:"not-hash"}),/invalid_checkpoint/);
});
