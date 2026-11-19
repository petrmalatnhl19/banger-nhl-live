"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { advancePinWithEvidence } = require("./core43_cal28_approved.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal28c-test";
const entry = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
function bundle(entries) {
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: entries.length,
    head: entries.at(-1)?.head || GENESIS, witnessId: witness };
  return { schema: "core43_cal22_transfer_v1", ledger: entries,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "cal28c-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pin = join(root, "pin.json"), archives = join(root, "archives");
  mkdirSync(archives);
  writeFileSync(pin, JSON.stringify({ sequence: 0, head: GENESIS }));
  return { pin, archives };
}
test("CAL-28C refuses missing evidence and preserves receiver pin", t => {
  const { pin, archives } = setup(t);
  assert.throws(() => advancePinWithEvidence(pin, bundle([entry]), publicKey, witness, entry.head, archives),
    /cal28b_missing_archive/);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
});
test("CAL-28C refuses fabricated archive and preserves receiver pin", t => {
  const { pin, archives } = setup(t);
  const path = join(archives, entry.archiveDigest);
  mkdirSync(path); writeFileSync(join(path, "manifest.json"), "{}");
  assert.throws(() => advancePinWithEvidence(pin, bundle([entry]), publicKey, witness, entry.head, archives),
    /cal28b_invalid_archive/);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
});
test("CAL-28C refuses incorrect approval without changing receiver pin", t => {
  const { pin, archives } = setup(t);
  assert.throws(() => advancePinWithEvidence(pin, bundle([]), publicKey, witness, "a".repeat(64), archives),
    /cal28c_approval_mismatch/);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
});
test("CAL-28C permits signed genesis replay with zero referenced archives", t => {
  const { pin, archives } = setup(t);
  const result = advancePinWithEvidence(pin, bundle([]), publicKey, witness, GENESIS, archives);
  assert.equal(result.status, "unchanged");
  assert.equal(result.archivesVerified, 0);
  assert.equal(result.evidenceStatus, "verified");
});
test("CAL-28C refuses absent archive root", t => {
  const { pin } = setup(t);
  assert.throws(() => advancePinWithEvidence(pin, bundle([]), publicKey, witness, GENESIS),
    /cal28c_archive_root_required/);
});
