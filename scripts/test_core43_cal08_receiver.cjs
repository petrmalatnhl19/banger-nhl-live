"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { generateKeyPairSync } = require("node:crypto");
const { chmodSync, existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { promisify } = require("node:util");
const { test } = require("node:test");
const { initializeLedger, receiveExport } = require("./core43_cal08_receiver.cjs");
const { fixture, signed, at, now } = require("./fixtures/core43_signed_export.cjs");

const exec = promisify(execFile);
const cli = join(__dirname, "core43_cal08_receiver.cjs");

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal08-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = join(dir, "ledger.sqlite");
  const payloadPath = join(dir, "bundle.json");
  const signaturePath = join(dir, "bundle.sig");
  const keyPath = join(dir, "key.pem");
  const { trust } = signed();
  const options = { ledgerPath, payloadPath, signaturePath, trust, clock: () => now };
  function write(input = signed()) {
    writeFileSync(payloadPath, input.bytes);
    writeFileSync(signaturePath, input.signature);
  }
  function init() {
    initializeLedger(ledgerPath, trust.source);
  }
  function count() {
    const db = new DatabaseSync(ledgerPath, { readOnly: true });
    try {
      return db.prepare("SELECT COUNT(*) AS count FROM receipts").get().count;
    } finally {
      db.close();
    }
  }

  write();
  return { dir, options, ledgerPath, payloadPath, signaturePath, keyPath, trust, write, init, count };
}

test("persists all four variants and returns the original receipt on a fresh retry", t => {
  const files = setup(t);
  files.init();
  const first = receiveExport(files.options);
  assert.equal(first.status, "accepted");
  assert.deepEqual(first.receipt.variants.map(row => row.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.equal(files.count(), 1);

  const reissued = fixture();
  reissued.issuedAt = at("22:01");
  files.write(signed(reissued));
  const retry = receiveExport({ ...files.options, clock: () => at("22:01") });
  assert.deepEqual(retry, { status: "duplicate", receipt: first.receipt });
  assert.equal(files.count(), 1);

  reissued.tables.schedules[0].kickoff_at = at("23:10");
  files.write(signed(reissued));
  const moved = receiveExport({ ...files.options, clock: () => at("22:01") });
  assert.equal(moved.status, "accepted");
  assert.equal(moved.receipt.kickoffAt, at("23:10"));
  assert.equal(files.count(), 2);
});

test("two distinct CLI processes sharing a ledger accept only one receipt", async t => {
  const files = setup(t);
  const { source, keyId, publicKey } = files.trust;
  await exec(process.execPath, ["--experimental-sqlite", cli, "init", files.ledgerPath, source]);
  const input = signed(fixture(new Date().toISOString()));
  files.write(input);
  writeFileSync(files.keyPath, publicKey.export({ type: "spki", format: "pem" }));
  const argv = ["--experimental-sqlite", cli, "receive", files.ledgerPath, files.payloadPath,
    files.signaturePath, files.keyPath, source, keyId];
  const runs = await Promise.all([exec(process.execPath, argv), exec(process.execPath, argv)]);
  const output = runs.map(run => JSON.parse(run.stdout));
  assert.deepEqual(output.map(result => result.status).sort(), ["accepted", "duplicate"]);
  assert.ok(output.every(result => result.gameId === "42"));
  assert.equal(files.count(), 1);
});

test("tampered, forged, wrong-origin and stale inputs leave history unchanged", t => {
  const files = setup(t);
  files.init();
  const input = signed();
  writeFileSync(files.payloadPath, Buffer.concat([input.bytes, Buffer.from(" ")]));
  assert.throws(() => receiveExport(files.options), /cal07_signature/);
  files.write(signed(fixture(), generateKeyPairSync("ed25519").privateKey));
  assert.throws(() => receiveExport(files.options), /cal07_signature/);
  const wrongSource = fixture();
  wrongSource.source = "other-project";
  files.write(signed(wrongSource));
  assert.throws(() => receiveExport(files.options), /cal07_manifest/);
  files.write();
  assert.throws(() => receiveExport({ ...files.options, clock: () => at("22:06") }), /cal07_freshness/);
  assert.equal(files.count(), 0);
});

test("requires every one of the 30 projected columns and rejects extra columns", t => {
  const files = setup(t);
  files.init();
  const projections = Object.entries(fixture().tables).map(([name, rows]) => [name, Object.keys(rows[0])]);
  assert.equal(projections.flatMap(([, columns]) => columns).length, 30);
  for (const [name, columns] of projections) {
    for (const column of columns) {
      const doc = fixture();
      delete doc.tables[name][0][column];
      files.write(signed(doc));
      assert.throws(() => receiveExport(files.options), /cal07_columns/, `${name}.${column}`);
    }
    const doc = fixture();
    doc.tables[name][0].unexpected = "ignored field would leak data";
    files.write(signed(doc));
    assert.throws(() => receiveExport(files.options), /cal07_columns/, name);
  }
  assert.equal(files.count(), 0);
});

test("absent state never bootstraps and corrupted or unsafe state stops processing", t => {
  const files = setup(t);
  assert.throws(() => receiveExport(files.options), { code: "ENOENT" });
  assert.equal(existsSync(files.ledgerPath), false);
  files.init();
  assert.throws(() => files.init(), { code: "EEXIST" });
  chmodSync(files.ledgerPath, 0o644);
  assert.throws(() => receiveExport(files.options), /cal08_ledger_permissions/);
  chmodSync(files.ledgerPath, 0o600);
  assert.throws(() => receiveExport({
    ...files.options, trust: { ...files.trust, source: "other-project" },
  }), /cal08_ledger_source/);
  writeFileSync(files.ledgerPath, "truncated SQLite db");
  assert.throws(() => receiveExport(files.options));
  assert.throws(() => files.init(), { code: "EEXIST" });
});

test("rejects oversized files and symlinks without changing history", t => {
  const files = setup(t);
  files.init();
  writeFileSync(files.payloadPath, Buffer.alloc(64 * 1024 + 1));
  assert.throws(() => receiveExport(files.options), /cal08_input_file/);
  files.write();
  const symlink = join(files.dir, "symlink.json");
  symlinkSync(files.payloadPath, symlink);
  assert.throws(() => receiveExport({ ...files.options, payloadPath: symlink }), { code: "ELOOP" });
  assert.equal(files.count(), 0);
});

test("a failed write rolls back and can be retried without a false duplicate", t => {
  const files = setup(t);
  files.init();
  const db = new DatabaseSync(files.ledgerPath);
  try {
    db.exec(`CREATE TRIGGER fail_write AFTER INSERT ON receipts
      BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END;`);
    assert.throws(() => receiveExport(files.options), /synthetic write failure/);
    assert.equal(files.count(), 0);
    db.exec("DROP TRIGGER fail_write");
    assert.equal(receiveExport(files.options).status, "accepted");
    assert.equal(files.count(), 1);
  } finally {
    db.close();
  }
});

test("an incomplete but valid package cannot claim the game", t => {
  const files = setup(t);
  files.init();
  const doc = fixture();
  doc.tables.goalieSnapshotRows = [];
  files.write(signed(doc));
  assert.deepEqual(receiveExport(files.options), { status: "skipped", reason: "missing_archived_pregame_gsax" });
  assert.equal(files.count(), 0);
  files.write();
  assert.equal(receiveExport(files.options).status, "accepted");
});
