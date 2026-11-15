"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { verifyIndependentReceipt } = require("./core43_cal28s_receipt.cjs");
const digest = "a".repeat(64);
const policy = { schema: "core43_cal28r_archive_policy_v1", storeId: "isolated.archive",
  trustDomain: "separate.account", writerPrincipal: "archive-writer",
  readerPrincipal: "receiver-reader", retentionMode: "compliance-worm",
  objectLockVerified: true, externalAuditVerified: true, digest };
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const otherKey = generateKeyPairSync("ed25519").publicKey;
function receipt() {
  const r = { schema: "core43_cal28s_receipt_v1", auditorId: "external-auditor",
    policyStoreId: policy.storeId, objectVersion: "version-001", digest };
  r.signature = sign(null, Buffer.from(JSON.stringify(r)), privateKey).toString("base64");
  return r;
}
test("CAL-28S signed synthetic receipt remains untrusted without external proof", () => {
  assert.deepEqual(verifyIndependentReceipt(policy, receipt(), digest, publicKey), {
    signatureValid: true, trusted: false, status: "offline_receipt_verified_only",
    reason: "provider_retention_and_permissions_not_independently_verified",
  });
});
test("CAL-28S rejects wrong auditor key", () => {
  assert.throws(() => verifyIndependentReceipt(policy, receipt(), digest, otherKey), /signature_verification_failed/);
});
test("CAL-28S rejects substituted object version", () => {
  const r = receipt(); r.objectVersion = "version-002";
  assert.throws(() => verifyIndependentReceipt(policy, r, digest, publicKey), /signature_verification_failed/);
});
test("CAL-28S rejects substituted digest", () => {
  const r = receipt(); r.digest = "b".repeat(64);
  assert.throws(() => verifyIndependentReceipt(policy, r, digest, publicKey), /receipt_binding_mismatch/);
});
test("CAL-28S rejects auditor principal equal to writer", () => {
  const r = receipt(); r.auditorId = policy.writerPrincipal;
  assert.throws(() => verifyIndependentReceipt(policy, r, digest, publicKey), /auditor_not_separate/);
});
test("CAL-28S rejects forged receipt schema", () => {
  const r = receipt(); r.trusted = true;
  assert.throws(() => verifyIndependentReceipt(policy, r, digest, publicKey), /invalid_receipt_schema/);
});
