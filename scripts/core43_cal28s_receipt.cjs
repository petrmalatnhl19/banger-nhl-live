"use strict";
// CAL-28S: offline, separately signed receipt verification; no live provider attestation.
const { createPublicKey, verify, KeyObject } = require("node:crypto");
const { validateArchiveTrustPolicy } = require("./core43_cal28r_archive_policy.cjs");
const HEX = /^[a-f0-9]{64}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
function verifyIndependentReceipt(policy, receipt, expectedDigest, trustedAuditorKey) {
  validateArchiveTrustPolicy(policy, expectedDigest);
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt) ||
      Object.keys(receipt).sort().join(",") !== "auditorId,digest,objectVersion,policyStoreId,schema,signature")
    throw Error("cal28s_invalid_receipt_schema");
  if (receipt.schema !== "core43_cal28s_receipt_v1" || receipt.digest !== expectedDigest ||
      receipt.policyStoreId !== policy.storeId || !HEX.test(receipt.digest))
    throw Error("cal28s_receipt_binding_mismatch");
  for (const key of ["auditorId", "objectVersion"]) {
    if (typeof receipt[key] !== "string" || !/^[a-zA-Z0-9._:-]{3,128}$/.test(receipt[key]))
      throw Error("cal28s_invalid_receipt_identity");
  }
  if (receipt.auditorId === policy.writerPrincipal || receipt.auditorId === policy.readerPrincipal)
    throw Error("cal28s_auditor_not_separate");
  if (typeof receipt.signature !== "string" || !B64.test(receipt.signature) ||
      Buffer.from(receipt.signature, "base64").toString("base64") !== receipt.signature)
    throw Error("cal28s_invalid_signature_encoding");
  const payload = JSON.stringify({
    schema: receipt.schema, auditorId: receipt.auditorId, policyStoreId: receipt.policyStoreId,
    objectVersion: receipt.objectVersion, digest: receipt.digest,
  });
  let ok = false;
  try {
    const key = trustedAuditorKey instanceof KeyObject && trustedAuditorKey.type === "public"
      ? trustedAuditorKey : createPublicKey(trustedAuditorKey);
    if (key.asymmetricKeyType !== "ed25519") throw Error("cal28s_wrong_key_type");
    ok = verify(null, Buffer.from(payload), key, Buffer.from(receipt.signature, "base64"));
  } catch (_) { throw Error("cal28s_signature_verification_failed"); }
  if (!ok) throw Error("cal28s_signature_verification_failed");
  return { signatureValid: true, trusted: false, status: "offline_receipt_verified_only",
    reason: "provider_retention_and_permissions_not_independently_verified" };
}
module.exports = { verifyIndependentReceipt };
