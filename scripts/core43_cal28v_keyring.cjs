"use strict";
// CAL-28V: offline pinned keyring and rotation validation. No live trust attestation.
const { createPublicKey, KeyObject, createHash } = require("node:crypto");
const { verifyIndependentArchiveAudit } = require("./core43_cal28u_independent_audit.cjs");
const HEX = /^[a-f0-9]{64}$/;
const DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
function parseDate(value) {
  if (typeof value !== "string" || !DATE.test(value) || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) throw Error("cal28v_invalid_date");
  return Date.parse(value);
}
function verifyKeyringEntry(entry, audit, nowIso) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !==
      ["schema","auditorId","keyId","publicKeyPem","fingerprint","validFrom","validUntil","revokedAt"].sort().join(","))
    throw Error("cal28v_invalid_keyring_schema");
  if (entry.schema !== "core43_cal28v_keyring_entry_v1" || entry.auditorId !== audit.auditorId ||
      typeof entry.keyId !== "string" || !/^[A-Za-z0-9._:-]{3,128}$/.test(entry.keyId))
    throw Error("cal28v_unknown_auditor_or_key");
  if (typeof entry.publicKeyPem !== "string") throw Error("cal28v_invalid_public_key");
  let key;
  try {
    key = createPublicKey(entry.publicKeyPem);
    if (!(key instanceof KeyObject) || key.asymmetricKeyType !== "ed25519")
      throw Error("wrong_algorithm");
  } catch (_) { throw Error("cal28v_invalid_public_key"); }
  const fingerprint = createHash("sha256").update(key.export({type:"spki",format:"der"})).digest("hex");
  if (!HEX.test(entry.fingerprint) || fingerprint !== entry.fingerprint)
    throw Error("cal28v_key_fingerprint_mismatch");
  const now = parseDate(nowIso), from = parseDate(entry.validFrom), until = parseDate(entry.validUntil);
  if (from >= until || now < from || now >= until) throw Error("cal28v_key_outside_validity");
  if (entry.revokedAt !== null) {
    const revoked = parseDate(entry.revokedAt);
    if (revoked <= now) throw Error("cal28v_key_revoked");
    // Future revocation is not evidence of a valid unrevoked key.
    throw Error("cal28v_untrusted_future_revocation");
  }
  return key;
}
function verifyAuditWithPinnedKeyring(policy, receipt, snapshot, audit, digest, receiptKey,
  keyring, expectedKeyId, nowIso) {
  if (!Array.isArray(keyring) || keyring.length === 0 || keyring.length > 32 ||
      typeof expectedKeyId !== "string") throw Error("cal28v_invalid_keyring");
  const matches = keyring.filter(e => e && e.keyId === expectedKeyId);
  if (matches.length !== 1) throw Error("cal28v_unknown_or_duplicate_key");
  const key = verifyKeyringEntry(matches[0], audit, nowIso);
  const result = verifyIndependentArchiveAudit(policy, receipt, snapshot, audit, digest,
    receiptKey, key, nowIso);
  return {...result, keyringValidated:true, trusted:false,
    status:"offline_pinned_key_verified_only"};
}
module.exports = { verifyKeyringEntry, verifyAuditWithPinnedKeyring };
