"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
test("CAL-28E approved receiver forwards archive root to lock-held writer", () => {
  const approved = readFileSync(join(__dirname, "core43_cal28_approved.cjs"), "utf8");
  const writer = readFileSync(join(__dirname, "core43_cal24_pin.cjs"), "utf8");
  assert.match(approved, /advancePin\(pinPath, transfer, trustedKey, witnessId, approvedHead, \{ archiveRoot \}\)/);
  assert.match(writer, /verifyTransferEvidence\(transfer, publicKey, witnessId, anchor, hooks\.archiveRoot\)/);
});
