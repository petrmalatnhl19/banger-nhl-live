"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal24-test";
const first = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const second = { seq: 2, archiveDigest: "b".repeat(64), previous: first.head,
  head: digestEntry(2, "b".repeat(64), first.head) };
function bundle(entries) {
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: entries.length,
    head: entries.at(-1)?.head || GENESIS, witnessId: witness };
  return { schema: "core43_cal22_transfer_v1", ledger: entries,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal24-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pin = join(dir, "pin.json");
  writeFileSync(pin, JSON.stringify({ sequence: 1, head: first.head }));
  return pin;
}
test("CAL-24 requires explicit matching approval and leaves pin unchanged on rejection", t => {
  const pin = setup(t), data = bundle([first, second]);
  assert.throws(() => advancePin(pin, data, publicKey, witness, first.head), /cal24_approval_mismatch/);
  assert.throws(() => advancePin(pin, data, publicKey, witness, "z".repeat(64)), /cal24_operator_approval_required/);
  assert.equal(JSON.parse(readFileSync(pin)).head, first.head);
});
test("CAL-24 advances atomically and treats replay as unchanged", t => {
  const pin = setup(t), data = bundle([first, second]);
  assert.equal(advancePin(pin, data, publicKey, witness, second.head).status, "advanced");
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 2, head: second.head });
  assert.equal(advancePin(pin, data, publicKey, witness, second.head).status, "unchanged");
});
test("CAL-24 pre-rename failure preserves original pin and cleans lock", t => {
  const pin = setup(t), data = bundle([first, second]);
  assert.throws(() => advancePin(pin, data, publicKey, witness, second.head,
    { onStage: stage => { if (stage === "temp_fsynced") throw Error("synthetic_crash"); } }), /synthetic_crash/);
  assert.equal(JSON.parse(readFileSync(pin)).head, first.head);
  assert.equal(existsSync(pin + ".lock"), false);
  assert.equal(advancePin(pin, data, publicKey, witness, second.head).status, "advanced");
});
test("CAL-24 post-rename failure retains advanced pin and allows replay", t => {
  const pin = setup(t), data = bundle([first, second]);
  assert.throws(() => advancePin(pin, data, publicKey, witness, second.head,
    { onStage: stage => { if (stage === "pin_renamed") throw Error("synthetic_crash"); } }), /synthetic_crash/);
  assert.equal(JSON.parse(readFileSync(pin)).head, second.head);
  assert.equal(advancePin(pin, data, publicKey, witness, second.head).status, "unchanged");
});
