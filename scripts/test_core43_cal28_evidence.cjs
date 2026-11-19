"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { verifyTransferEvidence } = require("./core43_cal28_evidence.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal28b-test";
function transfer(entries) {
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: entries.length,
    head: entries.at(-1)?.head || GENESIS, witnessId: witness };
  return { schema: "core43_cal22_transfer_v1", ledger: entries,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
const entry = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const anchor = { sequence: 0, head: GENESIS };
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "cal28b-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
test("CAL-28B accepts signed genesis transfer with no archives", t => {
  const root = setup(t);
  const result = verifyTransferEvidence(transfer([]), publicKey, witness, anchor, root);
  assert.equal(result.archivesVerified, 0);
});
test("CAL-28B refuses missing archive even with valid signed ledger", t => {
  const root = setup(t);
  assert.throws(() => verifyTransferEvidence(transfer([entry]), publicKey, witness, anchor, root),
    /cal28b_missing_archive:1/);
});
test("CAL-28B refuses fabricated manifest and does not accept hash alone", t => {
  const root = setup(t), path = join(root, entry.archiveDigest);
  mkdirSync(path);
  writeFileSync(join(path, "manifest.json"), "{}");
  assert.throws(() => verifyTransferEvidence(transfer([entry]), publicKey, witness, anchor, root),
    /cal28b_invalid_archive:1/);
});
test("CAL-28B refuses symlinked evidence directory", t => {
  const root = setup(t), outside = join(root, "outside");
  mkdirSync(outside); symlinkSync(outside, join(root, entry.archiveDigest));
  assert.throws(() => verifyTransferEvidence(transfer([entry]), publicKey, witness, anchor, root),
    /cal28b_unsafe_archive:1/);
});
test("CAL-28B checks signature before inspecting evidence", t => {
  const root = setup(t), data = transfer([entry]);
  data.checkpoint.signature = "A".repeat(86) + "==";
  assert.throws(() => verifyTransferEvidence(data, publicKey, witness, anchor, root),
    /cal21_bad_signature/);
});
