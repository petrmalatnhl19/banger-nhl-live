"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { verifyTransfer } = require("./core43_cal22_transfer.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { inspectPin } = require("./core43_cal25_audit.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal26-test";
const a = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const b = { seq: 2, archiveDigest: "b".repeat(64), previous: a.head,
  head: digestEntry(2, "b".repeat(64), a.head) };
function transfer(entries) {
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: entries.length,
    head: entries.at(-1)?.head || GENESIS, witnessId: witness };
  return { schema: "core43_cal22_transfer_v1", ledger: entries,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "cal26-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pin = join(root, "receiver-pin.json");
  writeFileSync(pin, JSON.stringify({ sequence: 1, head: a.head }));
  return pin;
}
test("CAL-26 signed transfer -> operator approval -> durable pin -> clean recovery audit", t => {
  const pin = setup(t), data = transfer([a, b]);
  const original = JSON.parse(readFileSync(pin, "utf8"));
  assert.equal(verifyTransfer(data, publicKey, witness, original).status, "verified");
  assert.equal(advancePin(pin, data, publicKey, witness, b.head).status, "advanced");
  assert.equal(inspectPin(pin).status, "consistent");
  assert.deepEqual(inspectPin(pin).pin, { sequence: 2, head: b.head });
  assert.equal(advancePin(pin, data, publicKey, witness, b.head).status, "unchanged");
});
test("CAL-26 rejects unapproved and tampered transfers without changing receiver trust", t => {
  const pin = setup(t), data = transfer([a, b]);
  assert.throws(() => advancePin(pin, data, publicKey, witness, a.head), /cal24_approval_mismatch/);
  const bad = transfer([a, b]);
  bad.checkpoint.signature = "A".repeat(86) + "==";
  assert.throws(() => advancePin(pin, bad, publicKey, witness, b.head), /cal21_bad_signature/);
  assert.deepEqual(JSON.parse(readFileSync(pin, "utf8")), { sequence: 1, head: a.head });
  assert.equal(inspectPin(pin).status, "consistent");
});
test("CAL-26 failed write before rename is recoverable; manual review blocks stale locks", t => {
  const pin = setup(t), data = transfer([a, b]);
  assert.throws(() => advancePin(pin, data, publicKey, witness, b.head,
    { onStage: s => { if (s === "temp_fsynced") throw Error("synthetic_interrupt"); } }),
    /synthetic_interrupt/);
  assert.equal(inspectPin(pin).status, "consistent");
  assert.equal(advancePin(pin, data, publicKey, witness, b.head).status, "advanced");
  mkdirSync(pin + ".lock");
  assert.equal(inspectPin(pin).status, "manual_review_required");
  assert.throws(() => advancePin(pin, data, publicKey, witness, b.head), /cal24_locked/);
  assert.equal(JSON.parse(readFileSync(pin, "utf8")).head, b.head);
});
