"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { GENESIS } = require("./core43_cal19_chain.cjs");
const { createSignedArchiveFixture } = require("./fixtures/core43_cal28_signed_archive.cjs");
const { advancePinWithEvidence } = require("./core43_cal28_approved.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
test("CAL-28G/H authentic synthetic RFC3161 evidence advances pin; missing root fails closed", t => {
  const { dir, pin, archives, entry, transfer, publicKey, witness } = createSignedArchiveFixture(t);
  assert.throws(() => advancePin(pin, transfer, publicKey, witness, entry.head,
    { archiveRoot: join(dir, "absent") }));
  assert.equal(JSON.parse(readFileSync(pin)).head, GENESIS);
  const result = advancePinWithEvidence(pin, transfer, publicKey, witness, entry.head, archives);
  assert.equal(result.status, "advanced");
  assert.equal(result.archivesVerified, 1);
  assert.deepEqual(JSON.parse(readFileSync(pin)), { sequence: 1, head: entry.head });
});
