"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { GENESIS, digestEntry, verifyChain, appendArchive } = require("./core43_cal19_chain.cjs");
const A = "a".repeat(64), B = "b".repeat(64);
const first = { seq: 1, archiveDigest: A, previous: GENESIS, head: digestEntry(1, A, GENESIS) };
const second = { seq: 2, archiveDigest: B, previous: first.head, head: digestEntry(2, B, first.head) };

test("CAL-19 validates linked evidence and pinned latest head", () => {
  assert.deepEqual(verifyChain([], GENESIS), { count: 0, head: GENESIS });
  assert.deepEqual(verifyChain([first, second], second.head), { count: 2, head: second.head });
});
test("CAL-19 rejects rollback, reordering, tampering and missing pinned head", () => {
  assert.throws(() => verifyChain([first], second.head), /cal19_rollback_or_fork/);
  assert.throws(() => verifyChain([second, first], second.head), /cal19_chain_invalid/);
  assert.throws(() => verifyChain([{ ...first, archiveDigest: B }], first.head), /cal19_chain_invalid/);
  assert.throws(() => verifyChain([first, { ...second, previous: GENESIS }], second.head), /cal19_chain_invalid/);
  assert.throws(() => verifyChain([first, second, { ...second, seq: 3 }]), /cal19_chain_invalid/);
  assert.throws(() => appendArchive("/missing", "/missing", undefined), /cal19_pin_required/);
});
