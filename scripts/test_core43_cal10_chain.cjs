"use strict";

const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync } = require("node:crypto");
const { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { initializeAuthority, readAuthority, restoreSnapshot } = require("./core43_cal09_ledger_transfer.cjs");
const { fixture, signed, at, now } = require("./fixtures/core43_signed_export.cjs");
const { runLedgerWorker } = require("./fixtures/core43_ledger_worker.cjs");

const matchups = [
  { gameId: "2026020201", away: "DAL", home: "NYR", kickoffOffset: 50, baseline: [3.2, 2.4],
    goalieIds: ["8480001", "8480002"], goalsAgainst: [55, 45] },
  { gameId: "2026020202", away: "BOS", home: "BUF", kickoffOffset: 60, baseline: [2.7, 3.1],
    goalieIds: ["8480003", "8480004"], goalsAgainst: [53, 39] },
  { gameId: "2026020203", away: "SEA", home: "VAN", kickoffOffset: 70, baseline: [2.6, 2.9],
    goalieIds: ["8480005", "8480006"], goalsAgainst: [42, 58] },
];

function chain(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal10-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const producer = join(dir, "producer");
  const inbox = join(dir, "inbox");
  const recovery = join(dir, "recovery");
  for (const path of [producer, inbox, recovery]) mkdirSync(path, { mode: 0o700 });
  const authorityPath = join(dir, "authority.sqlite");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const settings = {
    authorityPath, privateKey, trust: { publicKey, ledgerId: "cal10-test", source: signed().trust.source },
  };
  initializeAuthority({ ...settings, workspace: recovery });

  function stage(matchup, label, input = signed(fixture(now, matchup))) {
    const staged = join(producer, label);
    mkdirSync(staged, { mode: 0o700 });
    writeFileSync(join(staged, "bundle.json"), input.bytes);
    writeFileSync(join(staged, "bundle.sig"), input.signature);
    const delivered = join(inbox, label);
    const options = {
      ...settings, exportTrust: input.trust,
      payloadPath: join(delivered, "bundle.json"),
      signaturePath: join(delivered, "bundle.sig"),
    };
    return { staged, delivered, options, input, publish: () => renameSync(staged, delivered) };
  }

  async function receive(delivery, extras) {
    // Each execution starts with a different empty worker workspace.
    const workspace = mkdtempSync(join(dir, "worker-"));
    const result = await runLedgerWorker({ ...delivery.options, workspace }, extras);
    return JSON.parse(result.stdout);
  }

  function read() {
    return readAuthority(authorityPath);
  }

  function restore(snapshot, name, head = snapshot.head) {
    const target = join(recovery, name);
    restoreSnapshot({ bundle: snapshot.bundle, head, trust: settings.trust, target });
    const db = new DatabaseSync(target, { readOnly: true });
    try {
      return db.prepare("SELECT receipt FROM receipts ORDER BY game_id").all().map(row => JSON.parse(row.receipt));
    } finally {
      db.close();
    }
  }

  return { authorityPath, recovery, stage, receive, read, restore };
}

test("CAL-10 transfers three distinct NHL matchups across fresh workers and restores all 12 predictions", async t => {
  const env = chain(t);
  const receipts = [];
  for (const [index, matchup] of matchups.entries()) {
    const previous = env.read();
    const delivery = env.stage(matchup, matchup.gameId);
    delivery.publish();
    const { status, receipt } = await env.receive(delivery);
    assert.equal(status, "accepted");
    assert.equal(receipt.gameId, matchup.gameId);
    assert.equal(receipt.exportSha256, createHash("sha256").update(delivery.input.bytes).digest("hex"));
    assert.deepEqual(receipt.variants.map(variant => variant.coefficient), [0, 0.005, 0.02, 0.03]);
    assert.deepEqual([receipt.variants[0].away, receipt.variants[0].home], matchup.baseline);
    assert.equal(new Set(receipt.variants.map(({ away, home }) => JSON.stringify([away, home]))).size, 4);
    receipts.push(receipt);
    const current = env.read();
    assert.equal(current.head.generation, index + 1);
    assert.equal(JSON.parse(current.bundle.manifest).previousDigest, previous.head.digest);
  }
  const latest = env.read();
  const restored = env.restore(latest, "all-games.sqlite");
  assert.deepEqual(restored, receipts);
  assert.equal(new Set(restored.flatMap(receipt => receipt.variants.map(variant => variant.key))).size, 12);

  const reissued = fixture(now, matchups[0]);
  reissued.issuedAt = at("22:01");
  const delivery = env.stage(matchups[0], "reissued", signed(reissued));
  delivery.publish();
  const duplicate = await env.receive(delivery, { now: at("22:01") });
  assert.deepEqual(duplicate, { status: "duplicate", receipt: receipts[0] });
  assert.deepEqual(env.read().head, latest.head);
});

test("CAL-10 resumes after missing transport files and rejects a modified or forged export", async t => {
  const env = chain(t);
  const initial = env.read().head;
  const delivery = env.stage(matchups[1], "partial");
  await assert.rejects(env.receive(delivery), /ENOENT/);
  mkdirSync(delivery.delivered, { mode: 0o700 });
  writeFileSync(delivery.options.payloadPath, delivery.input.bytes);
  await assert.rejects(env.receive(delivery), /ENOENT/);
  assert.deepEqual(env.read().head, initial);

  const forged = signed(fixture(now, matchups[1]), generateKeyPairSync("ed25519").privateKey);
  writeFileSync(delivery.options.signaturePath, forged.signature);
  await assert.rejects(env.receive(delivery), /cal07_signature/);
  writeFileSync(delivery.options.signaturePath, delivery.input.signature);
  writeFileSync(delivery.options.payloadPath, delivery.input.bytes.subarray(0, -1));
  await assert.rejects(env.receive(delivery), /cal07_signature/);
  assert.deepEqual(env.read().head, initial);

  writeFileSync(delivery.options.payloadPath, delivery.input.bytes);
  await assert.rejects(env.receive(delivery, { now: at("22:06") }), /cal07_freshness/);
  assert.deepEqual(env.read().head, initial);
  const { status, receipt } = await env.receive(delivery);
  assert.equal(status, "accepted");
  assert.deepEqual(env.restore(env.read(), "after-delivery.sqlite"), [receipt]);
});

test("CAL-10 recovers both a failed commit after local acceptance and a lost acknowledgement", async t => {
  const env = chain(t);
  const first = env.stage(matchups[0], "first");
  first.publish();
  const firstResult = await env.receive(first);
  const stable = env.read();
  const second = env.stage(matchups[2], "second");
  second.publish();

  const authority = new DatabaseSync(env.authorityPath);
  try {
    authority.exec(`CREATE TRIGGER transport_outage AFTER UPDATE ON head
      BEGIN SELECT RAISE(ABORT, 'simulated commit outage'); END;`);
    await assert.rejects(env.receive(second), /simulated commit outage/);
    assert.deepEqual(env.read().head, stable.head);
    assert.deepEqual(env.restore(env.read(), "before-retry.sqlite"), [firstResult.receipt]);
    authority.exec("DROP TRIGGER transport_outage");
  } finally {
    authority.close();
  }

  await assert.rejects(env.receive(second, { stop: "after" }), { code: 92 });
  const committed = env.read();
  assert.equal(committed.head.generation, 2);
  const retry = await env.receive(second);
  assert.equal(retry.status, "duplicate");
  assert.equal(retry.receipt.variants.length, 4);
  assert.deepEqual(env.restore(committed, "after-retry.sqlite"), [firstResult.receipt, retry.receipt]);
  assert.deepEqual(env.read().head, committed.head);
});

test("CAL-10 rejects truncated or stale history in a fresh recovery workspace", async t => {
  const env = chain(t);
  const first = env.stage(matchups[0], "first");
  first.publish();
  const firstResult = await env.receive(first);
  const old = env.read();
  const second = env.stage(matchups[1], "second");
  second.publish();
  const secondResult = await env.receive(second);
  const latest = env.read();

  assert.throws(() => env.restore(old, "recovered.sqlite", latest.head), /cal09_head_mismatch/);
  const truncated = { ...latest, bundle: { ...latest.bundle, sqlite: latest.bundle.sqlite.subarray(0, -1) } };
  assert.throws(() => env.restore(truncated, "recovered.sqlite"), /cal09_integrity/);
  assert.equal(existsSync(join(env.recovery, "recovered.sqlite")), false);
  assert.deepEqual(env.restore(latest, "recovered.sqlite"), [firstResult.receipt, secondResult.receipt]);
});
