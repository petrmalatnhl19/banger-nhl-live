"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { readFileSync, writeFileSync, rmSync, symlinkSync, linkSync, mkdirSync } = require("node:fs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const { GENESIS } = require("./core43_cal19_chain.cjs");

for (const kind of ["symlink", "hardlink", "tampered"]) {
  test("CAL-28J rejects " + kind + " evidence under receiver lock", t => {
    const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
    const target = join(archived.directory, "bundle.bin");
    const original = readFileSync(target);
    if (kind === "symlink") {
      const other = join(archived.directory, "outside.bin");
      writeFileSync(other, original);
      rmSync(target);
      symlinkSync(other, target);
    } else if (kind === "hardlink") {
      const other = join(archived.directory, "outside.bin");
      rmSync(target);
      writeFileSync(other, original);
      linkSync(other, target);
    } else {
      writeFileSync(target, Buffer.from("tampered"));
    }
    assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
      { archiveRoot: archives }), /cal28b_invalid_archive:1/);
    assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 0, head: GENESIS });
  });
}
test("CAL-28J rejects symlinked manifest without advancing pin", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  const manifest = join(archived.directory, "manifest.json");
  const other = join(archived.directory, "manifest-copy.json");
  writeFileSync(other, readFileSync(manifest));
  rmSync(manifest);
  symlinkSync(other, manifest);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives }), /cal28b_invalid_archive:1/);
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
});

test("CAL-28K refuses hardlinked manifest and leaves pin unchanged", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  const manifest = join(archived.directory, "manifest.json");
  linkSync(manifest, join(archived.directory, "manifest-hardlink.json"));
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives }), /cal28b_invalid_archive:1/);
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
});
test("CAL-28K refuses directory masquerading as evidence file", t => {
  const { pin, archives, archived, transfer, publicKey, witness, entry } = createSignedArchiveFixture(t);
  const file = join(archived.directory, "request.tsq");
  rmSync(file);
  mkdirSync(file);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: archives }), /cal28b_invalid_archive:1/);
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
});
