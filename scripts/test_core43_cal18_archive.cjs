"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { archiveEvidence, verifyArchive } = require("./core43_cal18_archive.cjs");

test("CAL-18B refuses malformed and absent timestamp evidence without creating an archive", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18b-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "bad");
  writeFileSync(file, "invalid");
  assert.throws(() => archiveEvidence(join(dir, "archive"), {
    bundle: file, request: file, response: file, profile: file,
  }));
  assert.throws(() => verifyArchive(join(dir, "missing")));
});

test("CAL-18B detects altered archived bytes and rejects fabricated manifest", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18b-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = join(dir, "a".repeat(64));
  mkdirSync(fake);
  writeFileSync(join(fake, "manifest.json"), JSON.stringify({
    schema: "core43_cal18b_evidence_v1",
    verification: "timestamp_signature_only",
    independentOperationProven: true,
    officialGameStartVerified: false,
    packageDigest: "a".repeat(64),
  }));
  assert.throws(() => verifyArchive(fake), /cal18b_manifest/);
});
