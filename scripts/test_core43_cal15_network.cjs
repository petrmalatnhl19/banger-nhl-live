"use strict";

const assert = require("node:assert/strict");
const { execFile, execFileSync, spawn } = require("node:child_process");
const { X509Certificate, randomBytes } = require("node:crypto");
const { once } = require("node:events");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir, userInfo } = require("node:os");
const { join } = require("node:path");
const { createInterface } = require("node:readline");
const { test } = require("node:test");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");
const { prepare, load } = require("./core43_cal14_rehearsal.cjs");
const { readAccepted } = require("./core43_cal13_coordinator.cjs");

const exec = promisify(execFile);
const scope = process.env.CAL15_NETWORK_SCOPE;
assert.ok(scope === undefined || scope === "namespaces");
const isolated = scope === "namespaces";
const host = isolated ? "192.168.244.1" : "127.0.0.1";

function command(role, program, filename) {
  const argv = ["--experimental-sqlite", "-e", program, join(__dirname, filename)];
  if (!isolated) return [process.execPath, argv];
  return ["sudo", ["-n", "ip", "netns", "exec", role === "server" ? "cal15-a" : "cal15-b",
    "runuser", "-u", userInfo().username, "--", process.execPath, ...argv]];
}

const serverProgram = `
  const { readFileSync, readlinkSync } = require("node:fs");
  const { createInterface } = require("node:readline");
  const { authority, load } = require(process.argv[1]);
  const input = createInterface({ input: process.stdin });
  let server;
  input.once("line", line => {
    const cfg = JSON.parse(line);
    const pack = load(cfg.exchange, cfg.digest, cfg.rootFingerprint);
    if (cfg.corrupt) pack.blob = pack.blob.subarray(0, -1);
    server = authority({ ...cfg, pack, tls: {
      ca: readFileSync(cfg.caPath), cert: readFileSync(cfg.serverCert), key: readFileSync(cfg.serverKey),
    } });
    server.listen(0, cfg.host, () => console.log(JSON.stringify({
      port: server.address().port, namespace: readlinkSync("/proc/self/ns/net"),
    })));
  });
  input.once("close", () => { if (server) server.close(); });
`;

const clientProgram = `
  const { readFileSync, readlinkSync } = require("node:fs");
  const { downloadPackage, submitPackage } = require(process.argv[1]);
  const cfg = JSON.parse(readFileSync(0, "utf8"));
  const credentials = (identity, token) => ({
    origin: cfg.origin, ca: readFileSync(cfg.caPath), token,
    ...identity && { cert: readFileSync(identity.cert), key: readFileSync(identity.key) },
  });
  (async () => {
    if (cfg.action === "submit") {
      const bytes = readFileSync(cfg.fixturePath);
      const result = await submitPackage(credentials(cfg.submitter, cfg.submitToken), bytes);
      console.log(JSON.stringify(result));
      return;
    }
    const bytes = await downloadPackage(credentials(cfg.reader, cfg.readToken), cfg.digest);
    if (cfg.action === "download") {
      console.log(JSON.stringify({ length: bytes.length, namespace: readlinkSync("/proc/self/ns/net") }));
      return;
    }
    const result = await submitPackage(credentials(cfg.submitter, cfg.submitToken), bytes);
    console.log(JSON.stringify(result));
  })().catch(error => { console.error(error.code ?? error.message); process.exitCode = 1; });
`;

async function start(config) {
  const [bin, argv] = command("server", serverProgram, "core43_cal14_rehearsal.cjs");
  const worker = spawn(bin, argv, { stdio: ["pipe", "pipe", "inherit"] });
  const done = once(worker, "exit");
  const stdout = createInterface({ input: worker.stdout });
  worker.stdin.on("error", () => {});
  worker.stdin.write(JSON.stringify(config) + "\n");
  const [line] = await Promise.race([
    once(stdout, "line"),
    done.then(([code]) => { throw Error("Test server exited before listening: " + code); }),
  ]);
  const endpoint = JSON.parse(line);
  return {
    origin: `https://${config.host}:${endpoint.port}`,
    namespace: endpoint.namespace,
    async stop() {
      worker.stdin.end();
      const [code] = await done;
      assert.equal(code, 0);
    },
  };
}

function client(config) {
  const [bin, argv] = command("client", clientProgram, "core43_cal13_transport.cjs");
  const running = exec(bin, argv, { timeout: 8000 });
  running.child.stdin.end(JSON.stringify(config));
  return running.then(({ stdout }) => JSON.parse(stdout));
}

function tlsFixtures(dir) {
  const openssl = args => execFileSync("openssl", args, { stdio: "ignore" });
  const caPath = join(dir, "ca.pem"), caKey = join(dir, "ca.key");
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=CAL15-test-CA", "-addext", "basicConstraints=critical,CA:TRUE", "-out", caPath, "-keyout", caKey]);
  function leaf(label, purpose, ip) {
    const cert = join(dir, label + ".pem"), key = join(dir, label + ".key"), csr = join(dir, label + ".csr");
    openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=" + label,
      "-addext", "extendedKeyUsage=" + purpose, ...(ip ? ["-addext", "subjectAltName=IP:" + ip] : []),
      "-out", csr, "-keyout", key]);
    openssl(["x509", "-req", "-in", csr, "-CA", caPath, "-CAkey", caKey, "-CAcreateserial", "-days", "1",
      "-copy_extensions", "copy", "-out", cert]);
    return { cert, key, pin: new X509Certificate(readFileSync(cert)).fingerprint256 };
  }
  return { caPath, server: leaf("server", "serverAuth", host),
    wrongServer: leaf("wrongServer", "serverAuth", "192.168.244.99"),
    reader: leaf("reader", "clientAuth"), submitter: leaf("submitter", "clientAuth") };
}

test("mTLS network rehearsal validates identities, restart and exactly-once acceptance", { timeout: 30000 }, async t => {
  const dir = mkdtempSync(join(tmpdir(), "cal15-"));
  let endpoint;
  t.after(async () => {
    if (endpoint) await endpoint.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  const tls = tlsFixtures(dir);
  const exchange = join(dir, "exchange");
  const pins = prepare(exchange);
  const statePath = join(dir, "coordinator.sqlite");
  const { trust } = load(exchange, pins.digest, pins.rootFingerprint);
  const readToken = randomBytes(32).toString("base64url");
  const submitToken = randomBytes(32).toString("base64url");
  const common = { ...pins, exchange, host, statePath, caPath: tls.caPath, readToken, submitToken,
    peerPins: { read: tls.reader.pin, submit: tls.submitter.pin } };

  async function change(identity, patch) {
    if (endpoint) await endpoint.stop();
    endpoint = undefined;
    endpoint = await start({ ...common, serverCert: identity.cert, serverKey: identity.key, ...patch });
  }
  const request = (patch = {}) => client({ ...pins, origin: endpoint.origin, caPath: tls.caPath, readToken, submitToken,
    reader: tls.reader, submitter: tls.submitter, fixturePath: join(exchange, "bundle.json"), ...patch });

  await change(tls.wrongServer, { init: true });
  await assert.rejects(request(), /ERR_TLS_CERT_ALTNAME_INVALID/);
  await change(tls.server, { corrupt: true });
  await assert.rejects(request({ caPath: tls.wrongServer.cert }), /UNABLE_TO_VERIFY_LEAF_SIGNATURE|UNABLE_TO_GET_ISSUER_CERT|SELF_SIGNED_CERT_IN_CHAIN/);
  await assert.rejects(request(), /cal13_download_integrity/);
  assert.equal(readAccepted(statePath, pins.digest, trust), null);

  await change(tls.server, { dropAfterCommit: true });
  await assert.rejects(request({ reader: null }), /ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED|ECONNRESET/);
  await assert.rejects(request({ reader: tls.submitter }), /cal13_http_403/);
  await assert.rejects(request({ action: "submit", submitter: tls.reader }), /cal13_http_403/);
  await assert.rejects(request({ action: "submit", submitToken: readToken }), /cal13_http_403/);
  await assert.rejects(request({ readToken: submitToken }), /cal13_http_403/);
  assert.equal(readAccepted(statePath, pins.digest, trust), null);
  const download = await request({ action: "download" });
  assert.ok(download.length > 0);
  if (isolated) assert.notEqual(download.namespace, endpoint.namespace);
  const burst = await Promise.allSettled([request(), request(), request()]);
  const lost = burst.filter(outcome => outcome.status === "rejected");
  assert.equal(lost.length, 1);
  assert.match(lost[0].reason.stderr, /ECONNRESET/);
  for (const outcome of burst.filter(entry => entry.status === "fulfilled")) {
    assert.deepEqual(outcome.value, { status: "duplicate", digest: pins.digest });
  }

  await change(tls.server, {});
  const repeats = await Promise.all([request(), request(), request()]);
  assert.deepEqual(repeats, Array(3).fill({ status: "duplicate", digest: pins.digest }));
  const stored = readAccepted(statePath, pins.digest, trust);
  assert.deepEqual(stored.payload.capture.prediction.variants.map(row => row.coefficient), [0, 0.005, 0.02, 0.03]);
  const db = new DatabaseSync(statePath, { readOnly: true });
  try { assert.equal(db.prepare("SELECT count(*) AS rows FROM captures").get().rows, 1); }
  finally { db.close(); }
});
