"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const { GENESIS } = require("./core43_cal19_chain.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
test("CAL-24 requires matching approval; signed archive pin unchanged on rejection", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, GENESIS, { archiveRoot: archives }), /cal24_approval_mismatch/);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, "z".repeat(64), { archiveRoot: archives }), /cal24_operator_approval_required/);
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
});
test("CAL-24 verified signed archive advances atomically and replay is unchanged", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 1, head: entry.head });
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "unchanged");
});
test("CAL-24 signed archive pre-rename failure preserves pin and cleans lock", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives, onStage: stage => { if (stage === "temp_fsynced") throw Error("synthetic_crash"); } }), /synthetic_crash/);
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
  assert.equal(existsSync(pin + ".lock"), false);
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
});
test("CAL-24 signed archive post-rename failure retains pin and permits replay", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives, onStage: stage => { if (stage === "pin_renamed") throw Error("synthetic_crash"); } }), /synthetic_crash/);
  assert.equal(JSON.parse(readFileSync(pin)).head, entry.head);
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "unchanged");
});
