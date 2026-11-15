"use strict";
// CAL-28R offline policy contract only: NOT a proof of external storage immutability.
const { isDeepStrictEqual } = require("node:util");
const HEX = /^[a-f0-9]{64}$/;
const FIELDS = ["schema", "storeId", "trustDomain", "writerPrincipal", "readerPrincipal",
  "retentionMode", "objectLockVerified", "externalAuditVerified", "digest"];
function validateArchiveTrustPolicy(policy, expectedDigest) {
  if (!policy || typeof policy !== "object" || Array.isArray(policy) ||
      !isDeepStrictEqual(Object.keys(policy).sort(), [...FIELDS].sort()))
    throw Error("cal28r_invalid_policy_schema");
  if (policy.schema !== "core43_cal28r_archive_policy_v1" ||
      !HEX.test(expectedDigest) || policy.digest !== expectedDigest)
    throw Error("cal28r_invalid_digest_binding");
  for (const key of ["storeId", "trustDomain", "writerPrincipal", "readerPrincipal"]) {
    if (typeof policy[key] !== "string" || !/^[a-zA-Z0-9._:-]{3,128}$/.test(policy[key]))
      throw Error("cal28r_invalid_identity:" + key);
  }
  if (policy.writerPrincipal === policy.readerPrincipal)
    throw Error("cal28r_principal_separation_required");
  if (policy.retentionMode !== "compliance-worm" ||
      policy.objectLockVerified !== true || policy.externalAuditVerified !== true)
    throw Error("cal28r_external_attestation_required");
  // The self-declared booleans are NOT evidence. Require an out-of-band verification
  // before enabling a future production gate.
  return { status: "policy_shape_valid_only", trusted: false, reason: "external_attestation_not_verified" };
}
module.exports = { validateArchiveTrustPolicy };
