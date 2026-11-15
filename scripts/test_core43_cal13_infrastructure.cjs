"use strict";

const assert = require("node:assert/strict");
const { execFile, execFileSync } = require("node:child_process");
const { createHash, generateKeyPairSync, randomBytes, sign } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { createServer } = require("node:https");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { test } = require("node:test");
const { promisify } = require("node:util");
const { prepareCapture, attestCapture } = require("./core43_cal12_archive.cjs");
const { initializeCoordinator, installRegistry, acceptPackage, readAccepted } = require("./core43_cal13_coordinator.cjs");
const { downloadPackage, submitPackage, makeHandler } = require("./core43_cal13_transport.cjs");
const { at, fixture, now, signed } = require("./fixtures/core43_signed_export.cjs");

const exec = promisify(execFile);
const root = generateKeyPairSync("ed25519");
const exporter = generateKeyPairSync("ed25519");
const witness = generateKeyPairSync("ed25519");
const newExporter = generateKeyPairSync("ed25519");
const schema = "core43_cal13_keys_v1";
const trust = { rootKey: root.publicKey, origin: "simulation", source: signed().trust.source };
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

function keyRecord(id, role, pair, extra = {}) {
  return { id, role, publicKey: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    notBefore: at("21:00"), notAfter: at("23:00"), revoked: false, ...extra };
}

const firstKeys = [keyRecord("publisher-1", "export", exporter), keyRecord("witness-1", "witness", witness)];

function registry(version, keys = firstKeys, signer = root.privateKey) {
  const body = { schema, version, origin: trust.origin, source: trust.source, keys };
  const signature = sign(null, Buffer.concat([Buffer.from(schema + "\0"), Buffer.from(JSON.stringify(body))]), signer);
  return { body, signature: signature.toString("base64url") };
}

function makePackage(gameId = "2026020293", { key = exporter, id = "publisher-1", observedAt = at("22:01"), value = 3 } = {}) {
  const doc = fixture(now, { gameId, baseline: [value, 2.8] });
  doc.keyId = id;
  const { bytes, signature } = signed(doc, key.privateKey);
  const exportTrust = { keyId: id, source: doc.source, publicKey: key.publicKey };
  const data = { bytes, signature, exportTrust, origin: trust.origin, now };
  const capture = prepareCapture(data);
  const receipt = attestCapture({
    ...data, capture, witnessId: "witness-1", privateKey: witness.privateKey, clock: () => observedAt,
  });
  return Buffer.from(JSON.stringify({
    exportBytes: bytes.toString("base64url"), exportSignature: signature.toString("base64url"), capture, receipt,
  }));
}

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal13-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "coordinator.sqlite");
  initializeCoordinator(path, registry(1), trust);
  return { dir, path };
}

test("coordinator commits an entire witnessed capture and detects replay, conflict and corruption", t => {
  const { path } = setup(t);
  const bad = JSON.parse(makePackage());
  bad.exportSignature = Buffer.alloc(64).toString("base64url");
  assert.throws(() => acceptPackage(path, Buffer.from(JSON.stringify(bad)), trust), /cal07_signature/);
  const data = makePackage();
  const accepted = acceptPackage(path, data, trust);
  assert.deepEqual(accepted, { status: "accepted", digest: hash(data) });
  assert.deepEqual(acceptPackage(path, data, trust), { ...accepted, status: "duplicate" });
  assert.deepEqual(acceptPackage(path, makePackage("2026020293", { value: 3.2 }), trust), { ...accepted, status: "conflict" });
  const { payload, evidence } = readAccepted(path, accepted.digest, trust);
  assert.deepEqual(payload.capture.prediction.variants.map(v => v.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.equal(evidence.observedAt, at("22:01"));
  assert.equal(payload.capture.prediction.origin, "simulation");
  const db = new DatabaseSync(path);
  try {
    db.prepare("UPDATE captures SET package = ?").run(Buffer.from("{}"));
  } finally { db.close(); }
  assert.throws(() => readAccepted(path, accepted.digest, trust), /cal13_stored_integrity/);
});

test("signed registry allows bounded rotation and refuses rollback, fork, and revocation reversal", t => {
  const { path } = setup(t);
  const oldPackage = makePackage();
  const old = acceptPackage(path, oldPackage, trust);
  const keys = [keyRecord("publisher-1", "export", exporter, { notAfter: at("22:02") }), firstKeys[1],
    keyRecord("publisher-2", "export", newExporter, { notBefore: at("22:02") })];
  const next = registry(2, keys);
  assert.throws(() => installRegistry(path, registry(2, keys, exporter.privateKey), trust), /cal13_registry_signature/);
  assert.equal(installRegistry(path, next, trust), true);
  assert.equal(installRegistry(path, next, trust), false);
  assert.throws(() => installRegistry(path, registry(1), trust), /cal13_registry_rollback/);
  assert.throws(() => installRegistry(path, registry(2), trust), /cal13_registry_rollback/);
  assert.ok(readAccepted(path, old.digest, trust));
  assert.throws(() => acceptPackage(path, makePackage("2026020294", { observedAt: at("22:03") }), trust), /cal13_inactive_key/);
  const options = { key: newExporter, id: "publisher-2", observedAt: at("22:03") };
  const rotated = acceptPackage(path, makePackage("2026020294", options), trust);
  assert.equal(rotated.status, "accepted");
  const revoked = keys.map(k => k.id === "publisher-1" ? { ...k, revoked: true } : k);
  assert.equal(installRegistry(path, registry(3, revoked), trust), true);
  assert.throws(() => readAccepted(path, old.digest, trust), /cal13_inactive_key/);
  assert.throws(() => acceptPackage(path, oldPackage, trust), /cal13_inactive_key/);
  assert.ok(readAccepted(path, rotated.digest, trust));
  assert.throws(() => installRegistry(path, registry(4, keys), trust), /cal13_registry_history/);
  const disk = new DatabaseSync(path, { readOnly: true });
  try {
    assert.deepEqual(disk.prepare("SELECT version FROM policy_history ORDER BY version").all().map(row => row.version), [1, 2, 3]);
    assert.deepEqual(disk.prepare("SELECT registry_version FROM captures ORDER BY game_id").all()
      .map(row => row.registry_version), [1, 2]);
  } finally { disk.close(); }
});

test("registry rejects shared private-key roles, unexpected origin and early observations", t => {
  const { path } = setup(t);
  assert.throws(() => installRegistry(path,
    registry(2, [...firstKeys, keyRecord("shared", "witness", exporter)]), trust), /cal13_registry_key/);
  assert.throws(() => installRegistry(path, registry(2), { ...trust, origin: "historical" }), /cal13_registry/);
  const newKeys = [...firstKeys, keyRecord("publisher-2", "export", newExporter, { notBefore: at("22:02") })];
  installRegistry(path, registry(2, newKeys), trust);
  assert.throws(() => acceptPackage(path, makePackage("2026020294", { key: newExporter, id: "publisher-2" }), trust),
    /cal13_inactive_key/);
});

test("failed commit rolls back; reopening preserves accepted packages and policy", t => {
  const { path } = setup(t);
  const bytes = makePackage();
  const db = new DatabaseSync(path);
  try {
    db.exec(`CREATE TRIGGER simulated_outage AFTER INSERT ON captures
      BEGIN SELECT RAISE(ABORT, 'commit unavailable'); END`);
    assert.throws(() => acceptPackage(path, bytes, trust), /commit unavailable/);
    assert.equal(readAccepted(path, hash(bytes), trust), null);
    db.exec("DROP TRIGGER simulated_outage");
  } finally { db.close(); }
  assert.equal(acceptPackage(path, bytes, trust).status, "accepted");
  assert.equal(acceptPackage(path, bytes, trust).status, "duplicate");
  assert.equal(installRegistry(path, registry(2), trust), true);
  assert.throws(() => installRegistry(path, registry(1), trust), /cal13_registry_rollback/);
  const damaged = new DatabaseSync(path);
  try {
    damaged.exec(`UPDATE policy SET (version, digest, registry) =
      (SELECT version, digest, registry FROM policy_history WHERE version = 1)`);
  } finally { damaged.close(); }
  assert.throws(() => readAccepted(path, hash(bytes), trust), /cal13_registry_integrity/);
});

const clientScript = `
  const fs = require("node:fs");
  const { downloadPackage, submitPackage } = require(process.argv[1]);
  const cfg = JSON.parse(fs.readFileSync(0, "utf8"));
  const ca = fs.readFileSync(cfg.cert);
  downloadPackage({ origin: cfg.origin, ca, token: cfg.readToken }, cfg.digest)
    .then(bytes => submitPackage({ origin: cfg.origin, ca, token: cfg.submitToken }, bytes))
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
`;

function receiveOnWorker(config) {
  const child = exec(process.execPath, ["--experimental-sqlite", "-e", clientScript,
    join(__dirname, "core43_cal13_transport.cjs")]);
  child.child.stdin.end(JSON.stringify(config));
  return child.then(({ stdout }) => JSON.parse(stdout));
}

test("independent HTTPS clients enforce read-only delivery, deduplicate and retry a lost reply", async t => {
  const { dir, path } = setup(t);
  const cert = join(dir, "cert.pem");
  const key = join(dir, "key.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-out", cert, "-keyout", key],
  { stdio: "ignore" });
  const ca = readFileSync(cert);
  const readToken = randomBytes(32).toString("base64url");
  const submitToken = randomBytes(32).toString("base64url");
  const first = makePackage();
  const second = makePackage("2026020294");
  const firstDigest = hash(first);
  const secondDigest = hash(second);
  const objects = new Map([[firstDigest, first], [secondDigest, second]]);
  let loseReply = false;
  let redirect = false;
  const handler = makeHandler({ readToken, submitToken, readObject: digest => objects.get(digest),
    submit: bytes => acceptPackage(path, bytes, trust) });
  const server = createServer({ cert: ca, key: readFileSync(key), minVersion: "TLSv1.2" }, (req, res) => {
    if (redirect && req.url.startsWith("/objects/")) { res.writeHead(302, { Location: "https://127.0.0.1:9/blocked" }).end(); return; }
    if (loseReply && req.url.startsWith("/submissions/")) {
      // The actual coordinator persists first via the handler, then the socket drops before the body.
      res.end = function () { req.socket.destroy(); return this; };
    }
    void handler(req, res);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const origin = "https://127.0.0.1:" + server.address().port;
  const config = { origin, cert, readToken, submitToken };
  const reader = { origin, ca, token: readToken };
  const sender = { origin, ca, token: submitToken };

  await assert.rejects(submitPackage(reader, first), /cal13_http_403/);
  await assert.rejects(downloadPackage(sender, firstDigest), /cal13_http_403/);
  await assert.rejects(downloadPackage({ ...reader, origin: origin.replace("https:", "http:") }, firstDigest),
    /cal13_transport_config/);
  await assert.rejects(downloadPackage({ ...reader, ca: undefined }, firstDigest));
  redirect = true;
  await assert.rejects(downloadPackage(reader, firstDigest), /cal13_http_302/);
  redirect = false;
  objects.set(firstDigest, first.subarray(0, -1));
  await assert.rejects(downloadPackage(reader, firstDigest), /cal13_download_integrity/);
  objects.set(firstDigest, first);

  const result = await Promise.all([
    receiveOnWorker({ ...config, digest: firstDigest }), receiveOnWorker({ ...config, digest: firstDigest }),
  ]);
  assert.deepEqual(result.map(x => x.status).sort(), ["accepted", "duplicate"]);
  loseReply = true;
  await assert.rejects(receiveOnWorker({ ...config, digest: secondDigest }), /socket hang up/);
  assert.ok(readAccepted(path, secondDigest, trust));
  loseReply = false;
  assert.deepEqual(await receiveOnWorker({ ...config, digest: secondDigest }), { status: "duplicate", digest: secondDigest });
});
