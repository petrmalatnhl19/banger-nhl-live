"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { readFileSync, writeFileSync, symlinkSync, existsSync, statSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");
function unchanged(pin) {
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  assert.equal(existsSync(pin + ".lock"), false);
  assert.equal(existsSync(pin + ".next-" + process.pid), false);
}
test("CAL-28P rejects tampered private copy and removes private storage", t => {
  const { pin, archives, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  let snapshot;
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
    onStage(stage, root) {
      if (stage !== "snapshot_copied") return;
      snapshot = root;
      assert.equal(statSync(join(root, "..")).mode & 0o777, 0o700);
      writeFileSync(join(root, entry.archiveDigest, "bundle.bin"), "tampered private copy");
    },
  }), /cal28b_invalid_archive:1/);
  assert.equal(existsSync(join(snapshot, "..")), false);
  unchanged(pin);
});
test("CAL-28P rejects added source symlink even with otherwise valid evidence", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  symlinkSync(join(archived.directory, "bundle.bin"), join(archived.directory, "extra-link"));
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
    archiveRoot: archives,
  }), /cal28p_link_rejected/);
  unchanged(pin);
});
