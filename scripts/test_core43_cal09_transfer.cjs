"use strict";

const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { createHash, generateKeyPairSync, sign } = require("node:crypto");
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { promisify } = require("node:util");
const { initializeAuthority, readAuthority, receiveAcrossRuns, restoreSnapshot } = require("./core43_cal09_ledger_transfer.cjs");
const { fixture, signed, now } = require("./fixtures/core43_signed_export.cjs");

const exec = promisify(execFile);

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal09-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const first = join(dir, "first");
  const second = join(dir, "second");
  for (const host of [first, second]) mkdirSync(host, { mode: 0o700 });
  const authorityPath = join(dir, "authority.sqlite");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const trust = { publicKey, ledgerId: "test-ledger", source: signed().trust.source };
  const settings = { authorityPath, trust, privateKey };
  initializeAuthority({ ...settings, workspace: first });

  function options(workspace, gameId = "42") {
    const doc = fixture();
    doc.gameId = gameId;
    for (const rows of [doc.tables.schedules, doc.tables.predictions, doc.tables.observations]) {
      for (const row of rows) row.game_id = gameId;
    }
    const { bytes, signature, trust: exportTrust } = signed(doc);
    const payloadPath = join(workspace, "export.json");
    const signaturePath = join(workspace, "export.sig");
    writeFileSync(payloadPath, bytes);
    writeFileSync(signaturePath, signature);
    return { ...settings, workspace, payloadPath, signaturePath, exportTrust, clock: () => now };
  }
  return { dir, first, second, authorityPath, trust, privateKey, options };
}

function receipts(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db.prepare("SELECT receipt FROM receipts ORDER BY game_id").all().map(row => JSON.parse(row.receipt));
  } finally {
    db.close();
  }
}

test("restores an identical four-variant receipt on a separate workspace and rejects rollback", t => {
  const env = setup(t);
  const old = readAuthority(env.authorityPath);
  const accepted = receiveAcrossRuns(env.options(env.first));
  assert.equal(accepted.status, "accepted");
  const latest = readAuthority(env.authorityPath);
  assert.equal(latest.head.generation, 1);
  assert.equal(JSON.parse(latest.bundle.manifest).previousDigest, old.head.digest);
  const target = join(env.second, "restored.sqlite");
  assert.throws(() => restoreSnapshot({ bundle: old.bundle, head: latest.head, trust: env.trust, target }), /cal09_head_mismatch/);
  assert.equal(existsSync(target), false);
  restoreSnapshot({ ...latest, trust: env.trust, target });
  assert.deepEqual(receipts(target), [accepted.receipt]);
  assert.deepEqual(receipts(target)[0].variants.map(x => x.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.throws(() => restoreSnapshot({ ...latest, trust: env.trust, target }), { code: "EEXIST" });
  assert.deepEqual(receiveAcrossRuns(env.options(env.second)), { status: "duplicate", receipt: accepted.receipt });
  assert.deepEqual(readAuthority(env.authorityPath).head, latest.head);
});

test("rejects tampered bytes, a forged signature, and a different ledger binding", t => {
  const env = setup(t);
  const snapshot = readAuthority(env.authorityPath);
  const { bundle } = snapshot;
  const target = join(env.second, "restored.sqlite");
  const input = { ...snapshot, trust: env.trust, target };
  const corrupt = Buffer.from(bundle.sqlite);
  corrupt[0] ^= 1;
  assert.throws(() => restoreSnapshot({ ...input, bundle: { ...bundle, sqlite: corrupt } }), /cal09_integrity/);
  const forged = sign(null, Buffer.concat([Buffer.from("core43_cal09_ledger_v1\0"), bundle.manifest]),
    generateKeyPairSync("ed25519").privateKey);
  assert.throws(() => restoreSnapshot({ ...input, bundle: { ...bundle, signature: forged } }), /cal09_signature/);
  assert.throws(() => restoreSnapshot({ ...input, trust: { ...env.trust, ledgerId: "other" } }), /cal09_manifest/);
  assert.equal(existsSync(target), false);
});

function resign(snapshot, privateKey, changes, sqlite = snapshot.bundle.sqlite) {
  const sha = bytes => createHash("sha256").update(bytes).digest("hex");
  const manifest = Buffer.from(JSON.stringify({
    ...JSON.parse(snapshot.bundle.manifest), ...changes, sqliteSha256: sha(sqlite),
  }));
  const signature = sign(null, Buffer.concat([Buffer.from("core43_cal09_ledger_v1\0"), manifest]), privateKey);
  return { head: { ...snapshot.head, digest: sha(manifest) }, bundle: { manifest, signature, sqlite } };
}

test("rejects a signed unsupported schema or a receipt missing any prediction variant", t => {
  const env = setup(t);
  receiveAcrossRuns(env.options(env.first));
  const snapshot = readAuthority(env.authorityPath);
  const target = join(env.second, "verified.sqlite");
  const input = { trust: env.trust, target };
  assert.throws(() => restoreSnapshot({ ...resign(snapshot, env.privateKey, { version: 99 }), ...input }), /cal09_manifest/);
  const candidate = join(env.first, "changed.sqlite");
  writeFileSync(candidate, snapshot.bundle.sqlite, { mode: 0o600 });
  const db = new DatabaseSync(candidate);
  try {
    db.exec("PRAGMA user_version = 99");
  } finally {
    db.close();
  }
  assert.throws(() => restoreSnapshot({
    ...resign(snapshot, env.privateKey, {}, readFileSync(candidate)), ...input,
  }), /cal08_ledger_invalid/);
  const loss = new DatabaseSync(candidate);
  try {
    loss.exec("PRAGMA user_version = 1; CREATE TABLE unexpected(data TEXT)");
    assert.throws(() => restoreSnapshot({
      ...resign(snapshot, env.privateKey, {}, readFileSync(candidate)), ...input,
    }), /cal08_ledger_schema/);
    loss.exec("DROP TABLE unexpected; UPDATE receipts SET receipt = json_remove(receipt, '$.variants[2]')");
  } finally {
    loss.close();
  }
  assert.throws(() => restoreSnapshot({
    ...resign(snapshot, env.privateKey, {}, readFileSync(candidate)), ...input,
  }), /cal09_receipt/);
  assert.equal(existsSync(target), false);
});

const childProgram = `
  const { receiveAcrossRuns } = require(process.argv[1]);
  const { createPrivateKey, createPublicKey } = require("node:crypto");
  const { existsSync, writeFileSync } = require("node:fs");
  const config = JSON.parse(process.argv[2]);
  const shared = new Int32Array(new SharedArrayBuffer(4));
  let firstCall = true;
  const clock = () => {
    if (firstCall && config.marker) {
      firstCall = false;
      writeFileSync(config.marker, "");
      const until = Date.now() + 5000;
      while (!existsSync(config.peer)) {
        if (Date.now() > until) throw Error("fixture barrier timed out");
        Atomics.wait(shared, 0, 0, 10);
      }
    }
    if (config.stop === "before") process.exit(91);
    return config.now;
  };
  const outcome = receiveAcrossRuns({ ...config, clock,
    privateKey: createPrivateKey(config.privateKey),
    trust: { ...config.trust, publicKey: createPublicKey(config.trust.publicKey) },
    exportTrust: { ...config.exportTrust, publicKey: createPublicKey(config.exportTrust.publicKey) }
  });
  if (config.stop === "after") process.exit(92);
  console.log(JSON.stringify(outcome));
`;

function child(options, extras = {}) {
  const { trust, privateKey, exportTrust } = options;
  const pem = publicKey => publicKey.export({ type: "spki", format: "pem" });
  const config = { ...options, ...extras, now,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }),
    trust: { ...trust, publicKey: pem(trust.publicKey) },
    exportTrust: { ...exportTrust, publicKey: pem(exportTrust.publicKey) },
  };
  return exec(process.execPath, ["--experimental-sqlite", "-e", childProgram,
    join(__dirname, "core43_cal09_ledger_transfer.cjs"), JSON.stringify(config)]);
}

for (const sameGame of [true, false]) {
  test(sameGame ? "two competing workers accept the same game only once" :
    "competing accepted games retry against the new head without losing variants", async t => {
    const env = setup(t);
    const markers = [join(env.dir, "first.ready"), join(env.dir, "second.ready")];
    const results = await Promise.all([
      child(env.options(env.first), { marker: markers[0], peer: markers[1] }),
      child(env.options(env.second, sameGame ? "42" : "43"), { marker: markers[1], peer: markers[0] }),
    ]);
    const outcomes = results.map(result => JSON.parse(result.stdout));
    assert.deepEqual(outcomes.map(outcome => outcome.status).sort(), ["accepted", sameGame ? "duplicate" : "accepted"]);
    const latest = readAuthority(env.authorityPath);
    assert.equal(latest.head.generation, sameGame ? 1 : 2);
    const target = join(env.second, "current.sqlite");
    restoreSnapshot({ ...latest, trust: env.trust, target });
    assert.deepEqual(receipts(target), outcomes.filter(outcome => outcome.status === "accepted")
      .map(outcome => outcome.receipt).sort((a, b) => a.gameId.localeCompare(b.gameId)));
    assert.ok(receipts(target).every(receipt => receipt.variants.length === 4));
  });
}

test("recovers when a worker exits before commit or after commit but before reporting", async t => {
  const env = setup(t);
  const first = env.options(env.first);
  await assert.rejects(child(first, { stop: "before" }), { code: 91 });
  assert.equal(readAuthority(env.authorityPath).head.generation, 0);
  await assert.rejects(child(first, { stop: "after" }), { code: 92 });
  assert.equal(readAuthority(env.authorityPath).head.generation, 1);
  const resumed = receiveAcrossRuns(env.options(env.second));
  assert.equal(resumed.status, "duplicate");
  assert.equal(resumed.receipt.variants.length, 4);
  assert.equal(readAuthority(env.authorityPath).head.generation, 1);
});

test("a failed authority commit preserves the previous head and can be retried", t => {
  const env = setup(t);
  const original = readAuthority(env.authorityPath).head;
  const db = new DatabaseSync(env.authorityPath);
  try {
    db.exec(`CREATE TRIGGER fail_commit AFTER UPDATE ON head
      BEGIN SELECT RAISE(ABORT, 'synthetic authority failure'); END;`);
    assert.throws(() => receiveAcrossRuns(env.options(env.first)), /synthetic authority failure/);
    assert.deepEqual(readAuthority(env.authorityPath).head, original);
    db.exec("DROP TRIGGER fail_commit");
    assert.equal(receiveAcrossRuns(env.options(env.second)).status, "accepted");
    assert.equal(readAuthority(env.authorityPath).head.generation, 1);
  } finally {
    db.close();
  }
});
