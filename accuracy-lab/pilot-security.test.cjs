"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync } = require("node:crypto");
const { existsSync, mkdtempSync, readFileSync, rmSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { plan, runLive, artifactDecision, publishResult } = require("./pilot-automation.cjs");
const { generate, validatedSecrets } = require("./pilot-keys.cjs");
const { auditReceipt, accuracyBound } = require("./tsa-audit.cjs");
const { writeArchive } = require("./snapshot.cjs");
const { at, cutoff } = require("./pilot-test-fixture.cjs");

test("missing, malformed and unpinned environment keys stop before network access", async () => {
  const signingKey = generateKeyPairSync("ed25519").privateKey.export({ type: "pkcs8", format: "pem" });
  let calls = 0;
  for (const keys of [{}, { signingKey: "bad", archiveKey: "00".repeat(32) },
    { signingKey, archiveKey: "00".repeat(32), pins: {} }]) {
    await assert.rejects(() => runLive({ ...keys, now: () => at,
      fetcher: async () => { calls++; } }), /Missing, invalid or unpinned/);
  }
  assert.equal(calls, 0);
});

test("operator key generation uses private files outside the worktree and detects rotation", t => {
  const base = mkdtempSync(join(tmpdir(), "pilot-key-test-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  assert.throws(() => generate(join(__dirname, "should-not-exist")), /outside/);
  const folder = join(base, "keys");
  const pins = generate(folder);
  assert.equal(statSync(folder).mode & 0o777, 0o700);
  for (const name of ["signing.pem", "archive.hex", "pins.json"]) {
    assert.equal(statSync(join(folder, name)).mode & 0o777, 0o600);
  }
  const old = readFileSync(join(folder, "signing.pem"), "utf8");
  const aes = readFileSync(join(folder, "archive.hex"), "utf8");
  validatedSecrets(old, aes, { signer: pins.signingSpkiSha256, archive: pins.archiveKeySha256 });
  const next = generate(join(base, "next"));
  assert.throws(() => validatedSecrets(old, aes, { signer: next.signingSpkiSha256, archive: next.archiveKeySha256 }));
  assert.throws(() => generate(folder));
  assert.equal(readFileSync(join(folder, "archive.hex"), "utf8"), aes);
});

test("an interrupted reservation blocks retries while completed diagnostic attempts permit retry", () => {
  const candidate = suffix => ({ name: plan.artifact + "-" + suffix, expired: false,
    workflow_run: { head_branch: "core-accuracy-lab-01" } });
  const reservation = candidate("reservation-123-1");
  assert.equal(artifactDecision([]), "clear");
  assert.equal(artifactDecision([reservation, candidate("diagnostic-123-2")]), "reconcile");
  assert.equal(artifactDecision([reservation, candidate("diagnostic-123-1")]), "clear");
  assert.equal(artifactDecision([reservation, candidate("sealed")]), "sealed");
});

test("an interrupted staging write publishes nothing and publication is create-only", t => {
  const base = mkdtempSync(join(tmpdir(), "pilot-publish-test-"));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const target = join(base, "output");
  const result = { encrypted: { ciphertext: "synthetic" }, report: { status: "diagnostic" }, sealed: false };
  let writes = 0;
  assert.throws(() => publishResult(result, target, (data, file) => {
    if (++writes === 2) throw Error("synthetic disk failure");
    writeArchive(data, file);
  }), /disk failure/);
  assert.equal(existsSync(target), false);
  publishResult(result, target);
  assert.throws(() => publishResult({ ...result, sealed: true }, target), /already exists/);
  assert.equal(existsSync(join(target, "sealed-marker.json")), false);
});

test("an invalid timestamp and undeclared accuracy never confer external verification", () => {
  const invalid = Buffer.from("synthetic invalid DER");
  const audit = auditReceipt({ request: invalid, response: invalid, ca: invalid, signer: invalid,
    digest: "ab".repeat(32), cutoff: new Date(cutoff).toISOString() });
  assert.equal(audit.technicalValid, false);
  assert.equal(audit.status, "BLOCKED");
  assert.equal(audit.independentlyVerified, false);
  assert.equal(accuracyBound("unspecified"), null);
  assert.equal(accuracyBound("0x01 seconds, 0x01F4 millis, 0x01 micros"), 1501);
});
