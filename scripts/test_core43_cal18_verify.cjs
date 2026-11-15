"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { validateConfig, verifyFiles } = require("./core43_cal18_verify.cjs");

const profile = {
  kind: "independent", policyOid: "1.2.3.4.5",
  signerFingerprint256: "AA:".repeat(31) + "AA",
  maxAccuracyMs: 1000, caFile: "/no/such/file.pem",
};

test("CAL-18 refuses simulation and unpinned authority profiles", () => {
  for (const patch of [
    { kind: "test" }, { kind: "unknown" }, { maxAccuracyMs: -1 },
    { maxAccuracyMs: 0.5 }, { caFile: "" }, { policyOid: null },
    { signerFingerprint256: null }, { secretKey: "not-allowed" },
  ]) {
    assert.throws(() => validateConfig({ ...profile, ...patch }), /cal18_invalid_authority_profile/);
  }
});

test("CAL-18 never accepts missing or malformed evidence", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const files = ["bundle.json", "request.tsq", "response.tsr", "authority.json"]
    .map(name => join(dir, name));
  assert.throws(() => verifyFiles({}), /cal18_missing_file/);
  files.forEach(path => writeFileSync(path, "bad"));
  assert.throws(() => verifyFiles({
    packageFile: files[0], requestFile: files[1],
    responseFile: files[2], configFile: files[3],
  }));
  writeFileSync(files[3], JSON.stringify({ ...profile, caFile: files[0] }));
  assert.throws(() => verifyFiles({
    packageFile: files[0], requestFile: files[1],
    responseFile: files[2], configFile: files[3],
  }), /cal16_request/);
});

test("CAL-18 rejects unknown configuration fields", () => {
  assert.throws(() => validateConfig({ ...profile, bypassCertificate: true }), /cal18_invalid_authority_profile/);
});
