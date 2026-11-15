"use strict";
// CAL-28U: offline independent audit signature over exact synthetic provider metadata.
// Signatures prove message integrity only, never real-world provider controls.
const { createHash, createPublicKey, KeyObject, verify } = require("node:crypto");
const { verifyArchiveProviderSnapshot } = require("./core43_cal28t_provider_snapshot.cjs");
const FIELDS = ["schema","auditorId","storeId","objectVersion","digest","snapshotHash","finding","signature"];
const HEX = /^[a-f0-9]{64}$/;
function verifyIndependentArchiveAudit(policy, receipt, snapshot, audit, digest, receiptKey, auditKey, nowIso) {
  verifyArchiveProviderSnapshot(policy, receipt, snapshot, digest, receiptKey, nowIso);
  if (!audit || typeof audit !== "object" || Array.isArray(audit) ||
      Object.keys(audit).sort().join(",") !== [...FIELDS].sort().join(","))
    throw Error("cal28u_invalid_audit_schema");
  const snapshotHash = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  if (audit.schema !== "core43_cal28u_audit_v1" || audit.storeId !== policy.storeId ||
      audit.objectVersion !== receipt.objectVersion || audit.digest !== digest ||
      !HEX.test(audit.digest) || audit.snapshotHash !== snapshotHash ||
      audit.finding !== "synthetic_metadata_consistent")
    throw Error("cal28u_audit_binding_mismatch");
  if (typeof audit.auditorId !== "string" || !/^[a-zA-Z0-9._:-]{3,128}$/.test(audit.auditorId) ||
      audit.auditorId === policy.writerPrincipal || audit.auditorId === policy.readerPrincipal ||
      audit.auditorId === receipt.auditorId)
    throw Error("cal28u_auditor_separation_required");
  if (typeof audit.signature !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(audit.signature) ||
      Buffer.from(audit.signature, "base64").toString("base64") !== audit.signature)
    throw Error("cal28u_invalid_signature_encoding");
  const payload = JSON.stringify({schema:audit.schema,auditorId:audit.auditorId,
    storeId:audit.storeId,objectVersion:audit.objectVersion,digest:audit.digest,
    snapshotHash:audit.snapshotHash,finding:audit.finding});
  let valid = false;
  try {
    const key = auditKey instanceof KeyObject && auditKey.type === "public" ? auditKey : createPublicKey(auditKey);
    if (key.asymmetricKeyType !== "ed25519") throw Error("wrong_key");
    valid = verify(null, Buffer.from(payload), key, Buffer.from(audit.signature, "base64"));
  } catch (_) { throw Error("cal28u_audit_signature_invalid"); }
  if (!valid) throw Error("cal28u_audit_signature_invalid");
  return { auditSignatureValid: true, metadataConsistent: true, trusted: false,
    status: "offline_independent_signature_only",
    reason: "external_provider_and_auditor_independence_not_attested" };
}
module.exports = { verifyIndependentArchiveAudit };
