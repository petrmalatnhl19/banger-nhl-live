"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateArchiveTrustPolicy } = require("./core43_cal28r_archive_policy.cjs");
const digest = "a".repeat(64);
function policy() {
  return { schema: "core43_cal28r_archive_policy_v1", storeId: "isolated.archive",
    trustDomain: "separate.account", writerPrincipal: "archive-writer",
    readerPrincipal: "receiver-reader", retentionMode: "compliance-worm",
    objectLockVerified: true, externalAuditVerified: true, digest };
}
test("CAL-28R syntactically valid policy never claims independently trusted storage", () => {
  assert.deepEqual(validateArchiveTrustPolicy(policy(), digest), {
    status: "policy_shape_valid_only", trusted: false, reason: "external_attestation_not_verified",
  });
});
for (const [name, mutate, pattern] of [
  ["same principal", p => { p.readerPrincipal = p.writerPrincipal; }, /principal_separation/],
  ["wrong digest", p => { p.digest = "b".repeat(64); }, /invalid_digest_binding/],
  ["non-WORM mode", p => { p.retentionMode = "governance"; }, /external_attestation_required/],
  ["missing object lock claim", p => { p.objectLockVerified = false; }, /external_attestation_required/],
  ["missing external audit claim", p => { p.externalAuditVerified = false; }, /external_attestation_required/],
  ["unexpected policy field", p => { p.trusted = true; }, /invalid_policy_schema/],
]) {
  test("CAL-28R rejects " + name, () => {
    const p = policy(); mutate(p);
    assert.throws(() => validateArchiveTrustPolicy(p, digest), pattern);
  });
}
