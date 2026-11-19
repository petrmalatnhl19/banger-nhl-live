"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPairSync, sign } = require("node:crypto");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { verifyTransfer } = require("./core43_cal22_transfer.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const witnessId = "witness-offline-1";
const first = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const second = { seq: 2, archiveDigest: "b".repeat(64), previous: first.head,
  head: digestEntry(2, "b".repeat(64), first.head) };
function bundle(ledger) {
  const last = ledger.at(-1);
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: ledger.length,
    head: last?.head || GENESIS, witnessId };
  return { schema: "core43_cal22_transfer_v1", ledger,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
test("CAL-22 accepts a signed extension of independently pinned history", () => {
  const result = verifyTransfer(bundle([first, second]), publicKey, witnessId,
    { sequence: 1, head: first.head });
  assert.equal(result.status, "verified");
  assert.equal(result.next.sequence, 2);
});
test("CAL-22 rejects rollback, fork, substitution, forged signer and wrong witness", () => {
  const anchor = { sequence: 1, head: first.head };
  assert.throws(() => verifyTransfer(bundle([]), publicKey, witnessId, anchor), /cal22_rollback/);
  assert.throws(() => verifyTransfer(bundle([first, second]), publicKey, witnessId,
    { sequence: 1, head: "f".repeat(64) }), /cal19_rollback_or_fork/);
  const forged = bundle([first, second]);
  forged.ledger[1] = { ...second, archiveDigest: "c".repeat(64) };
  assert.throws(() => verifyTransfer(forged, publicKey, witnessId, anchor), /cal19_chain_invalid/);
  const otherKey = generateKeyPairSync("ed25519").publicKey;
  assert.throws(() => verifyTransfer(bundle([first, second]), otherKey, witnessId, anchor), /cal21_bad_signature/);
  assert.throws(() => verifyTransfer(bundle([first, second]), publicKey, "wrong-witness", anchor), /cal21_checkpoint_invalid/);
  assert.throws(() => verifyTransfer(bundle([first, second]), publicKey, witnessId, null), /cal22_invalid_transfer/);
});
test("CAL-22 accepts identical replay without advancing pinned head", () => {
  const result = verifyTransfer(bundle([first]), publicKey, witnessId, { sequence: 1, head: first.head });
  assert.equal(result.next.head, first.head);
});
