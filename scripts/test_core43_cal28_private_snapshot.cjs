"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");

test("CAL-28O verified private evidence copy permits stable signed archive", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  const result = advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives });
  assert.equal(result.status, "advanced");
  assert.equal(JSON.parse(readFileSync(pin)).head, entry.head);
});
test("CAL-28O fails closed on post-first-verification evidence mutation", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
    onStage(stage) {
      if (stage === "temp_fsynced")
        writeFileSync(join(archived.directory, "bundle.bin"), "mutated before snapshot");
    },
  }), /cal28b_invalid_archive:1/);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
  assert.equal(existsSync(pin + ".next-" + process.pid), false);
});
