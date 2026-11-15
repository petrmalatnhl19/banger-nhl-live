"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, createHash, sign } = require("node:crypto");
const { verifyAuditWithPinnedKeyring } = require("./core43_cal28v_keyring.cjs");
const digest="a".repeat(64),now="2026-11-15T21:00:00.000Z";
const policy={schema:"core43_cal28r_archive_policy_v1",storeId:"isolated.archive",
 trustDomain:"separate.account",writerPrincipal:"archive-writer",readerPrincipal:"receiver-reader",
 retentionMode:"compliance-worm",objectLockVerified:true,externalAuditVerified:true,digest};
const receiptKeys=generateKeyPairSync("ed25519"), auditKeys=generateKeyPairSync("ed25519");
function receipt(){
 const r={schema:"core43_cal28s_receipt_v1",auditorId:"receipt-auditor",
 policyStoreId:policy.storeId,objectVersion:"version-001",digest};
 r.signature=sign(null,Buffer.from(JSON.stringify(r)),receiptKeys.privateKey).toString("base64");return r;
}
function snapshot(){return {schema:"core43_cal28t_provider_snapshot_v1",storeId:policy.storeId,
 objectVersion:"version-001",digest,retentionMode:"compliance-worm",
 retentionUntil:"2027-11-15T21:00:00.000Z",objectLockEnabled:true,writerCanDelete:false,
 readerCanWrite:false,auditorCanWrite:false,observedAt:now,source:"offline-fixture"};}
function audit(s){
 const a={schema:"core43_cal28u_audit_v1",auditorId:"independent-auditor",
 storeId:policy.storeId,objectVersion:"version-001",digest,
 snapshotHash:createHash("sha256").update(JSON.stringify(s)).digest("hex"),
 finding:"synthetic_metadata_consistent"};
 a.signature=sign(null,Buffer.from(JSON.stringify(a)),auditKeys.privateKey).toString("base64");return a;
}
function entry(){
 const key=auditKeys.publicKey;
 return {schema:"core43_cal28v_keyring_entry_v1",auditorId:"independent-auditor",
 keyId:"auditor-2026",publicKeyPem:key.export({type:"spki",format:"pem"}),
 fingerprint:createHash("sha256").update(key.export({type:"spki",format:"der"})).digest("hex"),
 validFrom:"2026-01-01T00:00:00.000Z",validUntil:"2027-01-01T00:00:00.000Z",revokedAt:null};
}
function run(entries=[entry()],keyId="auditor-2026"){
 const s=snapshot();return verifyAuditWithPinnedKeyring(policy,receipt(),s,audit(s),digest,
 receiptKeys.publicKey,entries,keyId,now);
}
test("CAL-28V pinned key passes synthetic verification but remains untrusted",()=>{
 const r=run();assert.equal(r.keyringValidated,true);assert.equal(r.auditSignatureValid,true);
 assert.equal(r.trusted,false);
});
for(const [name,change,pattern] of [
 ["unknown key",e=>{e.keyId="different-key";},/unknown_or_duplicate_key/],
 ["revoked key",e=>{e.revokedAt="2026-11-14T21:00:00.000Z";},/key_revoked/],
 ["future revocation",e=>{e.revokedAt="2026-12-14T21:00:00.000Z";},/untrusted_future_revocation/],
 ["expired key",e=>{e.validUntil="2026-11-15T21:00:00.000Z";},/key_outside_validity/],
 ["not-yet-active key",e=>{e.validFrom="2026-11-16T00:00:00.000Z";},/key_outside_validity/],
 ["fingerprint mismatch",e=>{e.fingerprint="b".repeat(64);},/key_fingerprint_mismatch/],
 ["auditor mismatch",e=>{e.auditorId="other-auditor";},/unknown_auditor_or_key/],
 ["extra trust flag",e=>{e.trusted=true;},/invalid_keyring_schema/],
 ["invalid timestamp",e=>{e.validUntil="2027-02-30T00:00:00.000Z";},/invalid_date/],
]){
 test("CAL-28V rejects "+name,()=>{const e=entry();change(e);assert.throws(()=>run([e]),pattern);});
}
test("CAL-28V rejects duplicate key IDs",()=>assert.throws(()=>run([entry(),entry()]),/unknown_or_duplicate_key/));
test("CAL-28V rejects wrong signing key even with pinned key",()=>{
 const e=entry(),other=generateKeyPairSync("ed25519").publicKey;
 e.publicKeyPem=other.export({type:"spki",format:"pem"});
 e.fingerprint=createHash("sha256").update(other.export({type:"spki",format:"der"})).digest("hex");
 assert.throws(()=>run([e]),/audit_signature_invalid/);
});
