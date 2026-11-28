"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, mkdirSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { verifyTransfer } = require("./core43_cal22_transfer.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { inspectPin } = require("./core43_cal25_audit.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");

test("CAL-26 signed archive transfer -> approval -> durable pin -> clean audit", t => {
  const { pin, transfer, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  assert.equal(verifyTransfer(transfer, publicKey, witness, { sequence: 0, head: GENESIS }).status, "verified");
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
  assert.equal(inspectPin(pin).status, "consistent");
  assert.deepEqual(inspectPin(pin).pin, { sequence: 1, head: entry.head });
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "unchanged");
});
test("CAL-26 rejects unapproved and tampered signed archive transfers", t => {
  const { pin, transfer, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, GENESIS, { archiveRoot: archives }), /cal24_approval_mismatch/);
  const bad = structuredClone(transfer);
  bad.checkpoint.signature = "A".repeat(86) + "==";
  assert.throws(() => advancePin(pin, bad, publicKey, witness, entry.head, { archiveRoot: archives }), /cal21_bad_signature/);
  assert.deepEqual(JSON.parse(readFileSync(pin, "utf8")), { sequence: 0, head: GENESIS });
  assert.equal(inspectPin(pin).status, "consistent");
});
test("CAL-26 signed archive failed pre-rename write recovers; stale lock blocks", t => {
  const { pin, transfer, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives, onStage: s => { if (s === "temp_fsynced") throw Error("synthetic_interrupt"); } }),
    /synthetic_interrupt/);
  assert.equal(inspectPin(pin).status, "consistent");
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
  mkdirSync(pin + ".lock");
  assert.equal(inspectPin(pin).status, "manual_review_required");
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }), /cal24_locked/);
  assert.equal(JSON.parse(readFileSync(pin, "utf8")).head, entry.head);
});
