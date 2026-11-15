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
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal28-test";
const entry = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const cp = { schema: "core43_cal21_checkpoint_v1", sequence: 1, head: entry.head, witnessId: witness };
const data = { schema: "core43_cal22_transfer_v1", ledger: [entry],
  checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal28-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pin = join(dir, "pin.json");
  writeFileSync(pin, JSON.stringify({ sequence: 0, head: GENESIS }));
  return pin;
}
test("CAL-28 normal approved update succeeds with writer-owned lock", t => {
  const pin = setup(t);
  assert.equal(advancePin(pin, data, publicKey, witness, entry.head).status, "advanced");
});
test("CAL-28 refuses orphaned temporary file and does not erase it", t => {
  const pin = setup(t), temp = pin + ".next-999";
  writeFileSync(temp, "interrupted");
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head),
    /cal28_receiver_preflight_failed:orphaned_temp_review_required/);
  assert.equal(existsSync(temp), true);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
});
test("CAL-28 refuses symlinked receiver pin", t => {
  const pin = setup(t), target = pin + ".trusted";
  writeFileSync(target, readFileSync(pin));
  rmSync(pin); symlinkSync(target, pin);
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head),
    /cal28_receiver_preflight_failed:unsafe_pin_type/);
  assert.deepEqual(JSON.parse(readFileSync(target)), { sequence: 0, head: GENESIS });
});
test("CAL-28 refuses corrupt receiver pin", t => {
  const pin = setup(t);
  writeFileSync(pin, "{");
  assert.throws(() => advancePin(pin, data, publicKey, witness, entry.head),
    /cal28_receiver_preflight_failed:invalid_pin/);
  assert.equal(readFileSync(pin, "utf8"), "{");
});
