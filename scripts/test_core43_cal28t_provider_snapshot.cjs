"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { verifyArchiveProviderSnapshot } = require("./core43_cal28t_provider_snapshot.cjs");
const digest = "a".repeat(64), now = "2026-11-15T21:00:00.000Z";
const policy = { schema: "core43_cal28r_archive_policy_v1", storeId: "isolated.archive",
  trustDomain: "separate.account", writerPrincipal: "archive-writer",
  readerPrincipal: "receiver-reader", retentionMode: "compliance-worm",
  objectLockVerified: true, externalAuditVerified: true, digest };
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
function receipt() {
  const r = { schema: "core43_cal28s_receipt_v1", auditorId: "external-auditor",
    policyStoreId: policy.storeId, objectVersion: "version-001", digest };
  r.signature = sign(null, Buffer.from(JSON.stringify(r)), privateKey).toString("base64");
  return r;
}
function snapshot() {
  return { schema: "core43_cal28t_provider_snapshot_v1", storeId: policy.storeId,
    objectVersion: "version-001", digest, retentionMode: "compliance-worm",
    retentionUntil: "2027-11-15T21:00:00.000Z", objectLockEnabled: true,
    writerCanDelete: false, readerCanWrite: false, auditorCanWrite: false,
    observedAt: now, source: "offline-fixture" };
}
test("CAL-28T passing synthetic metadata explicitly remains untrusted", () => {
  const result = verifyArchiveProviderSnapshot(policy, receipt(), snapshot(), digest, publicKey, now);
  assert.equal(result.policyChecksPassed, true);
  assert.equal(result.trusted, false);
});
for (const [label, mutate, pattern] of [
  ["wrong version", s => { s.objectVersion = "version-002"; }, /object_binding_mismatch/],
  ["wrong digest", s => { s.digest = "b".repeat(64); }, /object_binding_mismatch/],
  ["governance retention", s => { s.retentionMode = "governance"; }, /unsafe_retention_or_permissions/],
  ["lock disabled", s => { s.objectLockEnabled = false; }, /unsafe_retention_or_permissions/],
  ["writer deletion", s => { s.writerCanDelete = true; }, /unsafe_retention_or_permissions/],
  ["reader writes", s => { s.readerCanWrite = true; }, /unsafe_retention_or_permissions/],
  ["auditor writes", s => { s.auditorCanWrite = true; }, /unsafe_retention_or_permissions/],
  ["expired retention", s => { s.retentionUntil = now; }, /expired_or_future_snapshot/],
  ["future observation", s => { s.observedAt = "2026-11-16T21:00:00.000Z"; }, /expired_or_future_snapshot/],
  ["fake provider source", s => { s.source = "provider-live"; }, /live_provider_evidence_not_supported/],
  ["unknown trust field", s => { s.trusted = true; }, /invalid_snapshot_schema/],
]) {
  test("CAL-28T rejects " + label, () => {
    const s = snapshot(); mutate(s);
    assert.throws(() => verifyArchiveProviderSnapshot(policy, receipt(), s, digest, publicKey, now), pattern);
  });
}
