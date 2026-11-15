"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical, verifyCheckpoint } = require("./core43_cal21_checkpoint.cjs");
const digest = "a".repeat(64);
const head = digestEntry(1, digest, GENESIS);
const ledger = [{ seq: 1, archiveDigest: digest, previous: GENESIS, head }];
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const other = generateKeyPairSync("ed25519").publicKey;
const witnessId = "offline-witness-01";
function make(fields = {}) {
  const data = { schema: "core43_cal21_checkpoint_v1", sequence: 1, head, witnessId, ...fields };
  return { ...data, signature: sign(null, canonical(data), privateKey).toString("base64") };
}
test("CAL-21 verifies an offline signed witness checkpoint with independent public key", () => {
  const result = verifyCheckpoint(make(), ledger, publicKey, witnessId, 1, head);
  assert.equal(result.status, "verified");
  assert.equal(result.sequence, 1);
});
test("CAL-21 rejects signature tampering, wrong signer, wrong witness and missing history", () => {
  assert.throws(() => verifyCheckpoint({ ...make(), head: "b".repeat(64) }, ledger, publicKey, witnessId, 1), /cal21_bad_signature/);
  assert.throws(() => verifyCheckpoint(make(), ledger, other, witnessId, 1), /cal21_bad_signature/);
  assert.throws(() => verifyCheckpoint(make(), ledger, publicKey, "other-witness", 1), /cal21_checkpoint_invalid/);
  assert.throws(() => verifyCheckpoint(make(), [], publicKey, witnessId, 1), /cal19_rollback_or_fork/);
  assert.throws(() => verifyCheckpoint(make(), ledger, publicKey, witnessId, 2), /cal21_checkpoint_invalid/);
  assert.throws(() => verifyCheckpoint(make(), ledger, publicKey, witnessId, 1, "b".repeat(64)), /cal21_checkpoint_invalid/);
});
test("CAL-21 rejects unsupported key type and forged checkpoint fields", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey;
  assert.throws(() => verifyCheckpoint(make(), ledger, rsa, witnessId, 1), /cal21_ed25519_required/);
  assert.throws(() => verifyCheckpoint({ ...make(), approved: true }, ledger, publicKey, witnessId, 1), /cal21_checkpoint_invalid/);
});
