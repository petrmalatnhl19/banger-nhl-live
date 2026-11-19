"use strict";
// CAL-23: two isolated child processes, separate directories and receiver-owned trust anchors.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { generateKeyPairSync } = require("node:crypto");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { GENESIS, digestEntry } = require("./core43_cal19_chain.cjs");
const { canonical } = require("./core43_cal21_checkpoint.cjs");
const { sign } = require("node:crypto");
const verifier = require.resolve("./core43_cal22_transfer.cjs");
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const publicPem = publicKey.export({ type: "spki", format: "pem" });
const witnessId = "cal23-test-witness";
const a = { seq: 1, archiveDigest: "a".repeat(64), previous: GENESIS,
  head: digestEntry(1, "a".repeat(64), GENESIS) };
const b = { seq: 2, archiveDigest: "b".repeat(64), previous: a.head,
  head: digestEntry(2, "b".repeat(64), a.head) };
function packageFor(entries) {
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: entries.length,
    head: entries.at(-1)?.head || GENESIS, witnessId };
  return { schema: "core43_cal22_transfer_v1", ledger: entries,
    checkpoint: { ...cp, signature: sign(null, canonical(cp), privateKey).toString("base64") } };
}
function scenario(t) {
  const root = mkdtempSync(join(tmpdir(), "cal23-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const sender = join(root, "sender"), receiver = join(root, "receiver");
  mkdirSync(sender); mkdirSync(receiver);
  const transfer = join(sender, "transfer.json"), key = join(receiver, "trusted.pem");
  const anchor = join(receiver, "anchor.json");
  writeFileSync(key, publicPem);
  writeFileSync(anchor, JSON.stringify({ sequence: 1, head: a.head }));
  function run(data, expected = 0) {
    writeFileSync(transfer, JSON.stringify(data));
    const result = spawnSync(process.execPath,
      [verifier, transfer, key, witnessId, anchor], { encoding: "utf8" });
    assert.equal(result.status, expected, result.stderr + result.stdout);
    return result;
  }
  return { run, anchor, transfer };
}
test("CAL-23 isolated receiver validates sender package with receiver-owned anchor", t => {
  const s = scenario(t);
  const result = s.run(packageFor([a, b]));
  assert.equal(JSON.parse(result.stdout).next.head, b.head);
  assert.equal(JSON.parse(readFileSync(s.anchor, "utf8")).head, a.head,
    "verification must never mutate the receiver pin");
});
test("CAL-23 rejects rollback, fork and tampered transfer across process boundary", t => {
  const s = scenario(t);
  s.run(packageFor([]), 1);
  const forged = { ...a, archiveDigest: "f".repeat(64) };
  s.run(packageFor([forged, b]), 1);
  const tampered = packageFor([a, b]);
  tampered.checkpoint.head = "f".repeat(64);
  s.run(tampered, 1);
  assert.equal(JSON.parse(readFileSync(s.anchor, "utf8")).head, a.head);
});
test("CAL-23 receiver crash before pin advancement leaves prior anchor and allows safe replay", t => {
  const s = scenario(t);
  const result = s.run(packageFor([a, b]));
  assert.equal(JSON.parse(result.stdout).next.head, b.head);
  // Simulate an abrupt receiver crash after verification, before any external pin approval.
  const crash = spawnSync(process.execPath, ["-e", "process.exit(77)"]);
  assert.equal(crash.status, 77);
  assert.equal(JSON.parse(readFileSync(s.anchor, "utf8")).head, a.head);
  assert.equal(JSON.parse(s.run(packageFor([a, b])).stdout).next.head, b.head);
});
