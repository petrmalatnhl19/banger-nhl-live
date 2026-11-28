"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { readFileSync, writeFileSync, renameSync, cpSync, existsSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");
function assertClean(pin) {
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
  assert.equal(existsSync(pin + ".next-" + process.pid), false);
}
test("CAL-28Q rejects source directory replacement at copy boundary", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
    onStage(stage) {
      if (stage !== "archive_copied") return;
      renameSync(archived.directory, archived.directory + ".old");
      cpSync(archived.directory + ".old", archived.directory, { recursive: true });
    },
  }), /cal28q_source_changed_during_copy/);
  assertClean(pin);
});
test("CAL-28Q rejects evidence mutation at final rename boundary", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
    onStage(stage) {
      if (stage === "before_pin_rename")
        writeFileSync(join(archived.directory, "bundle.bin"), "late mutation");
    },
  }), /cal28b_invalid_archive:1/);
  assertClean(pin);
});
test("CAL-28Q permits unchanged signed evidence", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
  }).status, "advanced");
});
