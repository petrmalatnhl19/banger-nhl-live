"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { prepare, load } = require("./core43_cal14_rehearsal.cjs");
const { archiveEvidence, verifyArchive } = require("./core43_cal18_archive.cjs");

test("CAL-18B refuses malformed and absent timestamp evidence without creating an archive", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18b-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "bad");
  writeFileSync(file, "invalid");
  assert.throws(() => archiveEvidence(join(dir, "archive"), {
    bundle: file, request: file, response: file, profile: file,
  }));
  assert.throws(() => verifyArchive(join(dir, "missing")));
});

test("CAL-18B detects altered archived bytes and rejects fabricated manifest", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18b-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const fake = join(dir, "a".repeat(64));
  mkdirSync(fake);
  writeFileSync(join(fake, "manifest.json"), JSON.stringify({
    schema: "core43_cal18b_evidence_v1",
    verification: "timestamp_signature_only",
    independentOperationProven: true,
    officialGameStartVerified: false,
    packageDigest: "a".repeat(64),
  }));
  assert.throws(() => verifyArchive(fake), /cal18b_manifest/);
});

test("CAL-18B archives a signed synthetic package with valid RFC3161 timestamp and detects tampering", t => {
  const dir = mkdtempSync(join(tmpdir(), "cal18b-positive-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = args => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
  const policy = "1.3.6.1.4.1.55555.18";
  run(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=CAL18B synthetic test CA",
    "-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-out", "ca.pem", "-keyout", "ca.key"]);
  run(["req", "-new", "-newkey", "rsa:2048", "-nodes",
    "-subj", "/CN=CAL18B synthetic test TSA",
    "-addext", "basicConstraints=critical,CA:FALSE",
    "-addext", "extendedKeyUsage=critical,timeStamping",
    "-addext", "keyUsage=critical,digitalSignature",
    "-out", "tsa.csr", "-keyout", "tsa.key"]);
  run(["x509", "-req", "-in", "tsa.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
    "-CAcreateserial", "-days", "1", "-copy_extensions", "copy", "-out", "tsa.pem"]);
  writeFileSync(join(dir, "serial"), "01\\n");
  writeFileSync(join(dir, "tsa.conf"), `[ tsa ]
default_tsa = test_tsa
[ test_tsa ]
serial = serial
signer_cert = tsa.pem
signer_key = tsa.key
certs = ca.pem
signer_digest = sha256
default_policy = ${policy}
digests = sha256
accuracy = secs:1,millisecs:2,microsecs:3
clock_precision_digits = 6
ordering = no
tsa_name = yes
ess_cert_id_chain = no
ess_cert_id_alg = sha256
`);
  const exchange = join(dir, "exchange");
  const pins = prepare(exchange, new Date(Date.now() - 90_000).toISOString());
  const pack = load(exchange, pins.digest, pins.rootFingerprint);
  assert.ok(pack.blob.length > 0);
  run(["ts", "-query", "-data", join(exchange, "bundle.json"),
    "-sha256", "-cert", "-tspolicy", policy, "-out", "request.tsq"]);
  run(["ts", "-reply", "-config", "tsa.conf", "-queryfile", "request.tsq", "-out", "response.tsr"]);
  const profile = join(dir, "profile.json");
  writeFileSync(profile, JSON.stringify({
    kind: "independent", policyOid: policy, maxAccuracyMs: 1500,
    signerFingerprint256: new X509Certificate(readFileSync(join(dir, "tsa.pem"))).fingerprint256,
    caFile: join(dir, "ca.pem"),
  }));
  const files = {
    bundle: join(exchange, "bundle.json"), request: join(dir, "request.tsq"),
    response: join(dir, "response.tsr"), profile,
  };
  const archived = archiveEvidence(join(dir, "evidence"), files);
  assert.equal(archived.manifest.packageDigest, pins.digest);
  assert.equal(archived.manifest.independentOperationProven, false);
  assert.deepEqual(verifyArchive(archived.directory), archived.manifest);
  assert.throws(() => archiveEvidence(join(dir, "evidence"), files), /cal18b_already_archived/);
  writeFileSync(join(archived.directory, "bundle.bin"), "tampered");
  assert.throws(() => verifyArchive(archived.directory), /cal18b_tampered_archive/);
});
