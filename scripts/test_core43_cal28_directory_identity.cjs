"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, renameSync, cpSync, existsSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");

for (const target of ["archive", "root"]) {
  test("CAL-28M rejects valid-byte " + target + " directory replacement before commit", t => {
    const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
    assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head, {
      archiveRoot: archives,
      onStage(stage) {
        if (stage !== "temp_fsynced") return;
        const path = target === "root" ? archives : archived.directory;
        renameSync(path, path + ".old");
        cpSync(path + ".old", path, { recursive: true });
      },
    }), /cal28m_archive_directory_identity_changed/);
    assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
    assert.equal(existsSync(pin + ".lock"), false);
    assert.equal(existsSync(pin + ".next-" + process.pid), false);
  });
}
