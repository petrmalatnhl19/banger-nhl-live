"use strict";
// CAL-28H reusable synthetic RFC3161 evidence fixture. Tests only; never use for real trust.
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { execFileSync } = require("node:child_process");
const { X509Certificate, generateKeyPairSync, sign } = require("node:crypto");
const { prepare, load } = require("../core43_cal14_rehearsal.cjs");
const { archiveEvidence } = require("../core43_cal18_archive.cjs");
const { GENESIS, digestEntry } = require("../core43_cal19_chain.cjs");
const { canonical } = require("../core43_cal21_checkpoint.cjs");
function createSignedArchiveFixture(t, witness = "cal28h-test") {
  const dir = mkdtempSync(join(tmpdir(), "cal28h-fixture-"));
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


  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const digest = archived.manifest.packageDigest;
  const entry = { seq: 1, archiveDigest: digest, previous: GENESIS, head: digestEntry(1, digest, GENESIS) };
  const cp = { schema: "core43_cal21_checkpoint_v1", sequence: 1, head: entry.head, witnessId: witness };
  const keys = generateKeyPairSync("ed25519");
  const transfer = { schema: "core43_cal22_transfer_v1", ledger: [entry],
    checkpoint: { ...cp, signature: sign(null, canonical(cp), keys.privateKey).toString("base64") } };
  const pin = join(dir, "pin.json");
  writeFileSync(pin, JSON.stringify({ sequence: 0, head: GENESIS }));
  return { dir, pin, archives: join(dir, "evidence"), entry, transfer, publicKey: keys.publicKey, witness, archived };
}
module.exports = { createSignedArchiveFixture };
