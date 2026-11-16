"use strict";

// Synthetic two-host rehearsal only. This entry point uses no live credentials or sources.
const { execFileSync } = require("node:child_process");
const { createHash, createPublicKey, generateKeyPairSync, randomBytes, sign } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { createServer } = require("node:https");
const { isIP } = require("node:net");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const assert = require("node:assert/strict");
const { checkPrivate, readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { prepareCapture, attestCapture } = require("./core43_cal12_archive.cjs");
const { initializeCoordinator, acceptPackage, readAccepted, MAX_PACKAGE_BYTES } = require("./core43_cal13_coordinator.cjs");
const { downloadPackage, makeHandler, submitPackage } = require("./core43_cal13_transport.cjs");
const { fixture, signed, now } = require("./fixtures/core43_signed_export.cjs");

const SOURCE = "banger-test-only";
const ORIGIN = "simulation";
const EPOCH = "core43_cal13_keys_v1";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const publicDer = key => key.export({ type: "spki", format: "der" });
const json = (path, limit = 64 * 1024) => JSON.parse(readBoundedFile(path, limit));

function prepare(directory, captureAt = now, matchup = { gameId: "2026029999" }) {
  const relative = minutes => new Date(Date.parse(captureAt) + minutes * 60_000).toISOString();
  const root = generateKeyPairSync("ed25519");
  const publisher = generateKeyPairSync("ed25519");
  const witness = generateKeyPairSync("ed25519");
  const exportTrust = { source: SOURCE, keyId: "cal14-export", publicKey: publisher.publicKey };
  const witnessId = "cal14-witness";
  const { gameId, away, home } = matchup;
  const doc = fixture(captureAt, { gameId, away, home });
  doc.keyId = exportTrust.keyId;
  const { bytes, signature } = signed(doc, publisher.privateKey);
  const input = { bytes, signature, exportTrust, origin: ORIGIN, now: captureAt };
  const capture = prepareCapture(input);
  const receipt = attestCapture({
    ...input, capture, witnessId, privateKey: witness.privateKey, clock: () => relative(1),
  });
  const blob = Buffer.from(JSON.stringify({
    exportBytes: bytes.toString("base64url"), exportSignature: signature.toString("base64url"), capture, receipt,
  }));
  const keys = [[exportTrust.keyId, "export", publisher.publicKey], [witnessId, "witness", witness.publicKey]]
    .map(([id, role, publicKey]) => ({ id, role, publicKey: publicDer(publicKey).toString("base64url"),
      notBefore: relative(-60), notAfter: relative(60), revoked: false }));
  const body = { schema: EPOCH, version: 1, origin: ORIGIN, source: SOURCE, keys };
  const registry = {
    body, signature: sign(null, Buffer.concat([Buffer.from(EPOCH + "\0"), Buffer.from(JSON.stringify(body))]),
      root.privateKey).toString("base64url"),
  };
  mkdirSync(directory, { mode: 0o700 });
  writeFileSync(join(directory, "bundle.json"), blob, { flag: "wx", mode: 0o600 });
  writeFileSync(join(directory, "registry.json"), JSON.stringify(registry), { flag: "wx", mode: 0o600 });
  writeFileSync(join(directory, "root-public.pem"), root.publicKey.export({ type: "spki", format: "pem" }),
    { flag: "wx", mode: 0o600 });
  return { digest: sha(blob), rootFingerprint: sha(publicDer(root.publicKey)) };
}

function load(directory, digest, rootFingerprint) {
  assert.ok(hex(digest) && hex(rootFingerprint), "cal14_pins");
  const rootKey = createPublicKey(readBoundedFile(join(directory, "root-public.pem"), 4096));
  assert.equal(sha(publicDer(rootKey)), rootFingerprint, "cal14_root_pin");
  const blob = readBoundedFile(join(directory, "bundle.json"), MAX_PACKAGE_BYTES);
  assert.equal(sha(blob), digest, "cal14_object_pin");
  return { blob, digest, trust: { rootKey, origin: ORIGIN, source: SOURCE }, registry: json(join(directory, "registry.json")) };
}

function authority({ statePath, init, pack, tls, readToken, submitToken, dropAfterCommit, peerPins }) {
  // Validate TLS and authorization configuration before creating state.
  makeHandler({ readToken, submitToken, peerPins });
  if (peerPins && !tls.ca) throw Error("cal15_client_ca");
  if (init) initializeCoordinator(statePath, pack.registry, pack.trust);
  let pendingDrop = dropAfterCommit;
  return createServer({ ...tls, minVersion: "TLSv1.2",
    ...(peerPins ? { requestCert: true, rejectUnauthorized: true } : {}) }, (req, res) => {
    const handler = makeHandler({
      readToken, submitToken, peerPins, readObject: digest => digest === pack.digest ? pack.blob : undefined,
      submit(bytes) {
        const result = acceptPackage(statePath, bytes, pack.trust);
        if (pendingDrop && result.status === "accepted") {
          pendingDrop = false;
          res.end = function () { req.socket.destroy(); return this; };
        }
        return result;
      },
    });
    void handler(req, res);
  });
}

async function receive({ origin, ca, readToken, submitToken, readClient, submitClient }, digest) {
  const bytes = await downloadPackage({ origin, ca, token: readToken, ...readClient }, digest);
  return submitPackage({ origin, ca, token: submitToken, ...submitClient }, bytes);
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => server.once("error", reject).listen(port, host, resolve));
}

function close(server) {
  return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function rehearse(pack) {
  const dir = mkdtempSync(join(tmpdir(), "cal14-"));
  let server;
  try {
    const cert = join(dir, "cert.pem"), key = join(dir, "key.pem");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
      "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1", "-out", cert, "-keyout", key],
    { stdio: "ignore" });
    const ca = readFileSync(cert);
    const readToken = randomBytes(32).toString("base64url");
    const submitToken = randomBytes(32).toString("base64url");
    const statePath = join(dir, "coordinator.sqlite");
    const options = { statePath, pack, tls: { cert: ca, key: readFileSync(key) }, readToken, submitToken };
    server = authority({ ...options, init: true, dropAfterCommit: true });
    await listen(server, 0, "127.0.0.1");
    const config = () => ({ origin: "https://127.0.0.1:" + server.address().port, ca, readToken, submitToken });
    await assert.rejects(submitPackage({ origin: config().origin, ca, token: readToken }, pack.blob), /cal13_http_403/);
    await assert.rejects(receive(config(), pack.digest), { code: "ECONNRESET" });
    await close(server);
    server = undefined;

    server = authority(options);
    await listen(server, 0, "127.0.0.1");
    const retry = await receive(config(), pack.digest);
    assert.deepEqual(retry, { status: "duplicate", digest: pack.digest });
    const variants = readAccepted(statePath, pack.digest, pack.trust).payload.capture.prediction.variants;
    assert.deepEqual(variants.map(item => item.coefficient), [0, 0.005, 0.02, 0.03]);
    return { digest: pack.digest, origin: ORIGIN, afterRestart: retry.status, verifiedVariants: variants.length };
  } finally {
    if (server?.listening) await close(server);
    rmSync(dir, { recursive: true, force: true });
  }
}

function privateIPv4(host) {
  return typeof host === "string" && isIP(host) === 4 &&
    /^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
}

function clientIdentity(config) {
  if (!config) return undefined;
  checkPrivate(config.keyPath, false);
  return { cert: readBoundedFile(config.certPath, 16 * 1024), key: readBoundedFile(config.keyPath, 16 * 1024) };
}

async function main([command, ...args]) {
  if (command === "prepare" && args.length === 1) return prepare(args[0]);
  if (command === "rehearse" && args.length === 3) return rehearse(load(...args));
  if (command === "inspect" && args.length === 4) {
    const [directory, digest, rootFingerprint, statePath] = args;
    const pack = load(directory, digest, rootFingerprint);
    const stored = readAccepted(statePath, digest, pack.trust);
    assert.ok(stored, "cal14_missing_receipt");
    return { digest, origin: ORIGIN,
      coefficients: stored.payload.capture.prediction.variants.map(item => item.coefficient) };
  }
  if (command === "receive" && args.length === 2) {
    checkPrivate(args[0], false);
    const { origin, certPath, readToken, submitToken, readClient, submitClient } = json(args[0]);
    return receive({ origin, ca: readBoundedFile(certPath, 16 * 1024), readToken, submitToken,
      readClient: clientIdentity(readClient), submitClient: clientIdentity(submitClient) }, args[1]);
  }
  if (command === "serve" && args.length === 4) {
    const [directory, digest, rootFingerprint, configPath] = args;
    checkPrivate(configPath, false);
    const config = json(configPath);
    assert.ok(privateIPv4(config.host) && Number.isInteger(config.port) && config.port >= 1024 &&
      config.port <= 65535, "cal14_private_address");
    checkPrivate(config.keyPath, false);
    const server = authority({
      ...config, pack: load(directory, digest, rootFingerprint),
      tls: { cert: readBoundedFile(config.certPath, 16 * 1024), key: readBoundedFile(config.keyPath, 16 * 1024),
        ca: config.clientCaPath ? readBoundedFile(config.clientCaPath, 16 * 1024) : undefined },
    });
    await listen(server, config.port, config.host);
    return { status: "listening", host: config.host, port: config.port, origin: ORIGIN };
  }
  throw Error("cal14_usage");
}

if (require.main === module) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify(result))).catch(error => {
    // Output only machine-readable errors; never log tokens, certificate keys or package content.
    const diagnostic = [error.code, error.message].find(value => /^(?:cal1[345]_[a-z0-9_]+|E[A-Z]+)$/.test(value ?? ""));
    console.error(diagnostic ?? "cal14_failed");
    process.exitCode = 1;
  });
}

module.exports = { authority, prepare, load, rehearse };
