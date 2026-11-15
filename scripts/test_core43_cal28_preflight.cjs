"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, writeFileSync, readFileSync, rmSync, symlinkSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
test("CAL-28 normal approved update succeeds with writer-owned lock", t => {
  const { pin, transfer: data, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  assert.equal(advancePin(pin, data, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
});
test("CAL-28 refuses orphaned temporary file and does not erase it", t => {
  const { pin, transfer: data, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  const temp = pin + ".next-999";
  writeFileSync(temp, "interrupted");
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head, { archiveRoot: archives }),
    /cal28_receiver_preflight_failed:orphaned_temp_review_required/);
  assert.equal(existsSync(temp), true);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
});
test("CAL-28 refuses symlinked receiver pin", t => {
  const { pin, transfer: data, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  const target = pin + ".trusted";
  writeFileSync(target, readFileSync(pin));
  rmSync(pin); symlinkSync(target, pin);
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head, { archiveRoot: archives }),
    /cal28_receiver_preflight_failed:unsafe_pin_type/);
  assert.deepEqual(JSON.parse(readFileSync(target)), { sequence: 0, head: GENESIS });
});
test("CAL-28 refuses corrupt receiver pin", t => {
  const { pin, transfer: data, publicKey, witness, entry, archives } = createSignedArchiveFixture(t);
  writeFileSync(pin, "{");
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head, { archiveRoot: archives }),
    /cal28_receiver_preflight_failed:invalid_pin/);
  assert.equal(readFileSync(pin, "utf8"), "{");
});
