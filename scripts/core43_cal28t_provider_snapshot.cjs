"use strict";
// CAL-28T: strict offline provider-metadata gate; caller-supplied metadata is NOT provider proof.
const { verifyIndependentReceipt } = require("./core43_cal28s_receipt.cjs");
const HEX = /^[a-f0-9]{64}$/;
const KEYS = ["schema","storeId","objectVersion","digest","retentionMode",
  "retentionUntil","objectLockEnabled","writerCanDelete","readerCanWrite",
  "auditorCanWrite","observedAt","source"];
function verifyArchiveProviderSnapshot(policy, receipt, snapshot, digest, auditorKey, nowIso) {
  const signed = verifyIndependentReceipt(policy, receipt, digest, auditorKey);
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot) ||
      Object.keys(snapshot).sort().join(",") !== [...KEYS].sort().join(","))
    throw Error("cal28t_invalid_snapshot_schema");
  if (snapshot.schema !== "core43_cal28t_provider_snapshot_v1" ||
      snapshot.storeId !== policy.storeId || snapshot.objectVersion !== receipt.objectVersion ||
      snapshot.digest !== digest || !HEX.test(snapshot.digest))
    throw Error("cal28t_object_binding_mismatch");
  if (snapshot.retentionMode !== "compliance-worm" || snapshot.objectLockEnabled !== true ||
      snapshot.writerCanDelete !== false || snapshot.readerCanWrite !== false ||
      snapshot.auditorCanWrite !== false)
    throw Error("cal28t_unsafe_retention_or_permissions");
  if (snapshot.source !== "offline-fixture")
    throw Error("cal28t_live_provider_evidence_not_supported");
  const strictDate = s => typeof s === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) &&
    Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
  if (!strictDate(nowIso) || !strictDate(snapshot.observedAt) || !strictDate(snapshot.retentionUntil))
    throw Error("cal28t_invalid_timestamp");
  if (Date.parse(snapshot.observedAt) > Date.parse(nowIso) ||
      Date.parse(snapshot.retentionUntil) <= Date.parse(nowIso))
    throw Error("cal28t_expired_or_future_snapshot");
  return { receiptSignatureValid: signed.signatureValid, policyChecksPassed: true,
    trusted: false, status: "offline_metadata_consistent_only",
    reason: "provider_identity_and_effective_permissions_not_independently_attested" };
}
module.exports = { verifyArchiveProviderSnapshot };
