"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witness = "cal28f-test";
const entry = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const cp = { schema: "core43_cal21_checkpoint_v1", sequence: 1, head: entry.head, witnessId: witness };
const transfer = { schema: "core43_cal22_transfer_v1", ledger: [entry],
  checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
function setup(t) {
  const root = mkdtempSync(join(tmpdir(), "cal28f-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const pin = join(root, "pin.json"), archives = join(root, "archives");
  mkdirSync(archives);
  writeFileSync(pin, JSON.stringify({ sequence: 0, head: GENESIS }));
  return { pin, archives };
}
test("CAL-28F locked writer rejects missing evidence without changing pin or leaving lock", t => {
  const { pin, archives } = setup(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }),
    /cal28b_missing_archive/);
  assert.deepEqual(JSON.parse(readFileSync(pin, "utf8")), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
});
test("CAL-28F locked writer rejects fabricated evidence without changing pin", t => {
  const { pin, archives } = setup(t);
  const fake = join(archives, entry.archiveDigest);
  mkdirSync(fake); writeFileSync(join(fake, "manifest.json"), "{}");
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }),
    /cal28b_invalid_archive/);
  assert.deepEqual(JSON.parse(readFileSync(pin, "utf8")), { sequence: 0, head: GENESIS });
});
