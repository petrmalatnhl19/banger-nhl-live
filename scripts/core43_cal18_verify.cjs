"use strict";

// CAL-18: Offline RFC 3161 interoperability check. No network, database or production credentials.
const { readFileSync } = require("node:fs");
const { verifyTimestamp } = require("./core43_cal16_timestamp.cjs");

function validateConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config) ||
      config.kind !== "independent" ||
      typeof config.policyOid !== "string" ||
      typeof config.signerFingerprint256 !== "string" ||
      !Number.isSafeInteger(config.maxAccuracyMs) || config.maxAccuracyMs < 0 ||
      typeof config.caFile !== "string" || !config.caFile ||
      Object.keys(config).some(k => !["kind","policyOid","signerFingerprint256","maxAccuracyMs","caFile"].includes(k))) {
    throw Error("cal18_invalid_authority_profile");
  }
  return config;
}

function verifyFiles({ packageFile, requestFile, responseFile, configFile }) {
  if (![packageFile, requestFile, responseFile, configFile].every(p => typeof p === "string" && p)) {
    throw Error("cal18_missing_file");
  }
  const config = validateConfig(JSON.parse(readFileSync(configFile, "utf8")));
  const result = verifyTimestamp({
    packageBytes: readFileSync(packageFile),
    request: readFileSync(requestFile),
    response: readFileSync(responseFile),
    authority: {
      kind: config.kind,
      policyOid: config.policyOid,
      signerFingerprint256: config.signerFingerprint256,
      maxAccuracyMs: config.maxAccuracyMs,
      caPem: readFileSync(config.caFile),
    },
  });
  return { schema: "core43_cal18_offline_verification_v1", status: "verified",
    sha256: result.digest, latestAt: new Date(result.latestMs).toISOString(),
    independentTsaProfile: true,
    note: "Cryptographic timestamp verification only; does not establish trusted real-world TSA operations, revocation status, or official game start." };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 6) throw Error("cal18_usage: node scripts/core43_cal18_verify.cjs package.json request.tsq response.tsr authority.json");
    console.log(JSON.stringify(verifyFiles({
      packageFile: process.argv[2], requestFile: process.argv[3],
      responseFile: process.argv[4], configFile: process.argv[5],
    }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateConfig, verifyFiles };
