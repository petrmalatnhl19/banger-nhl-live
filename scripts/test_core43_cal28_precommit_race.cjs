"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");

for (const mode of ["mutate-evidence", "swap-archive-directory"]) {
  test("CAL-28L blocks precommit " + mode + " and preserves receiver pin", t => {
    const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
    assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
      archiveRoot: archives,
      onStage(stage) {
        if (stage !== "temp_fsynced") return;
        if (mode === "mutate-evidence") {
          writeFileSync(join(archived.directory, "bundle.bin"), "concurrent mutation");
        } else {
          renameSync(archived.directory, archived.directory + ".moved");
          mkdirSync(archived.directory);
        }
      },
    }), /cal28b_invalid_archive:1/);
    assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
    assert.equal(existsSync(pin + ".lock"), false);
    assert.equal(existsSync(pin + ".next-" + process.pid), false);
  });
}
test("CAL-28L accepts stable evidence through second verification", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  assert.equal(advancePin(pin, transfer, publicKey, witness, entry.head, { archiveRoot: archives }).status, "advanced");
  assert.equal(JSON.parse(readFileSync(pin)).head, entry.head);
});
