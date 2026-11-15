"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, sign } = require("node:crypto");
const { verifyIndependentArchiveAudit } = require("./core43_cal28u_independent_audit.cjs");
const digest = "a".repeat(64), now = "2026-11-15T21:00:00.000Z";
const policy = {schema:"core43_cal28r_archive_policy_v1",storeId:"isolated.archive",
  trustDomain:"separate.account",writerPrincipal:"archive-writer",readerPrincipal:"receiver-reader",
  retentionMode:"compliance-worm",objectLockVerified:true,externalAuditVerified:true,digest};
const receiptKeys = generateKeyPairSync("ed25519");
const auditKeys = generateKeyPairSync("ed25519");
function receipt() {
  const r={schema:"core43_cal28s_receipt_v1",auditorId:"receipt-auditor",policyStoreId:policy.storeId,
    objectVersion:"version-001",digest};
  r.signature=sign(null,Buffer.from(JSON.stringify(r)),receiptKeys.privateKey).toString("base64");
  return r;
}
function snapshot() {
  return {schema:"core43_cal28t_provider_snapshot_v1",storeId:policy.storeId,
    objectVersion:"version-001",digest,retentionMode:"compliance-worm",
    retentionUntil:"2027-11-15T21:00:00.000Z",objectLockEnabled:true,
    writerCanDelete:false,readerCanWrite:false,auditorCanWrite:false,
    observedAt:now,source:"offline-fixture"};
}
function audit(s) {
  const a={schema:"core43_cal28u_audit_v1",auditorId:"independent-auditor",storeId:policy.storeId,
    objectVersion:"version-001",digest,
    snapshotHash:createHash("sha256").update(JSON.stringify(s)).digest("hex"),
    finding:"synthetic_metadata_consistent"};
  a.signature=sign(null,Buffer.from(JSON.stringify(a)),auditKeys.privateKey).toString("base64");
  return a;
}
function run(r,s,a,key=auditKeys.publicKey) {
  return verifyIndependentArchiveAudit(policy,r,s,a,digest,receiptKeys.publicKey,key,now);
}
test("CAL-28U valid synthetic signatures never establish provider trust",()=>{
  assert.deepEqual(run(receipt(),snapshot(),audit(snapshot())),{
    auditSignatureValid:true,metadataConsistent:true,trusted:false,
    status:"offline_independent_signature_only",
    reason:"external_provider_and_auditor_independence_not_attested"});
});
test("CAL-28U rejects changed snapshot after signature",()=>{
  const s=snapshot(),a=audit(s);s.readerCanWrite=true;
  assert.throws(()=>run(receipt(),s,a),/unsafe_retention_or_permissions/);
});
test("CAL-28U rejects substituted metadata digest",()=>{
  const s=snapshot(),a=audit(s);s.observedAt="2026-11-15T20:00:00.000Z";
  assert.throws(()=>run(receipt(),s,a),/audit_binding_mismatch/);
});
test("CAL-28U rejects wrong auditor key",()=>{
  const s=snapshot();assert.throws(()=>run(receipt(),s,audit(s),receiptKeys.publicKey),/audit_signature_invalid/);
});
test("CAL-28U rejects forged finding",()=>{
  const s=snapshot(),a=audit(s);a.finding="verified_live_provider";
  assert.throws(()=>run(receipt(),s,a),/audit_binding_mismatch/);
});
test("CAL-28U rejects receipt auditor reused for audit",()=>{
  const s=snapshot(),a=audit(s);a.auditorId="receipt-auditor";
  assert.throws(()=>run(receipt(),s,a),/auditor_separation_required/);
});
test("CAL-28U rejects extra trusted claim",()=>{
  const s=snapshot(),a=audit(s);a.trusted=true;
  assert.throws(()=>run(receipt(),s,a),/invalid_audit_schema/);
});
test("CAL-28U rejects tampered signature",()=>{
  const s=snapshot(),a=audit(s);a.signature=Buffer.alloc(64).toString("base64");
  assert.throws(()=>run(receipt(),s,a),/audit_signature_invalid/);
});
