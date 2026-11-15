"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { X509Certificate } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { prepare, load } = require("./core43_cal14_rehearsal.cjs");
const { initializeCoordinator, readAccepted } = require("./core43_cal13_coordinator.cjs");
const { acceptTimestampedPackage, verifyTimestamp } = require("./core43_cal16_timestamp.cjs");

const policy = "1.3.6.1.4.1.55555.16";

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), "cal16-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const run = args => execFileSync("openssl", args, { cwd: dir, stdio: "ignore" });
  run(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", "/CN=CAL16 test CA",
    "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-out", "ca.pem", "-keyout", "ca.key"]);
  run(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=CAL16 test TSA",
    "-addext", "basicConstraints=critical,CA:FALSE", "-addext", "extendedKeyUsage=critical,timeStamping",
    "-addext", "keyUsage=critical,digitalSignature", "-out", "tsa.csr", "-keyout", "tsa.key"]);
  run(["x509", "-req", "-in", "tsa.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-days", "1",
    "-copy_extensions", "copy", "-out", "tsa.pem"]);
  writeFileSync(join(dir, "serial"), "01\n");
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
  const requestArgs = ["ts", "-query", "-data", join(exchange, "bundle.json"), "-sha256", "-cert", "-tspolicy", policy];
  run([...requestArgs, "-out", "request.tsq"]);
  run([...requestArgs, "-out", "other.tsq"]);
  run([...requestArgs, "-no_nonce", "-out", "no-nonce.tsq"]);
  run(["ts", "-reply", "-config", "tsa.conf", "-queryfile", "request.tsq", "-out", "response.tsr"]);
  const state = join(dir, "coordinator.sqlite");
  initializeCoordinator(state, pack.registry, pack.trust);
  const prediction = JSON.parse(pack.blob).capture.prediction;
  const authority = {
    kind: "test", policyOid: policy, maxAccuracyMs: 1500,
    signerFingerprint256: new X509Certificate(readFileSync(join(dir, "tsa.pem"))).fingerprint256,
    caPem: readFileSync(join(dir, "ca.pem")),
  };
  const outcome = {
    origin: "simulation", sourceUrl: "fixture",
    officialStart: { at: prediction.kickoffAt, url: "https://www.nhl.com/scores/htmlreports/20262027/GS029999.HTM" },
    boxscore: {
      id: Number(prediction.gameId), startTimeUTC: prediction.kickoffAt, gameState: "OFF",
      gameOutcome: { lastPeriodType: "REG" },
      awayTeam: { abbrev: prediction.awayTeam, score: 4 }, homeTeam: { abbrev: prediction.homeTeam, score: 2 },
    },
  };
  const request = readFileSync(join(dir, "request.tsq"));
  const response = readFileSync(join(dir, "response.tsr"));
  return {
    state, pack, prediction, options: { packageBytes: pack.blob, request, response, authority, outcome },
    otherRequest: readFileSync(join(dir, "other.tsq")), noNonce: readFileSync(join(dir, "no-nonce.tsq")),
  };
}

test("real RFC 3161 response binds package, policy, accuracy and all four saved variants", t => {
  const { state, pack, options } = setup(t);
  const accepted = acceptTimestampedPackage(state, options, pack.trust);
  assert.equal(accepted.status, "accepted");
  assert.equal(accepted.digest, pack.digest);
  assert.equal(accepted.timestamp.authority, "test");
  assert.ok(Date.parse(accepted.timestamp.latestAt) < Date.parse(options.outcome.officialStart.at));
  const duplicate = acceptTimestampedPackage(state, options, pack.trust);
  assert.deepEqual(duplicate, { ...accepted, status: "duplicate" });
  const stored = readAccepted(state, accepted.digest, pack.trust);
  assert.deepEqual(stored.payload.capture.prediction.variants.map(variant => variant.coefficient), [0, 0.005, 0.02, 0.03]);
});

test("valid token is rejected at or after the independently supplied actual start", t => {
  const { state, pack, options } = setup(t);
  const { latestMs } = verifyTimestamp(options);
  const outcome = { ...options.outcome, officialStart: { ...options.outcome.officialStart,
    at: new Date(latestMs).toISOString() } };
  assert.throws(() => acceptTimestampedPackage(state, { ...options, outcome }, pack.trust), /cal16_late_timestamp/);
  outcome.officialStart.at = new Date(latestMs - 10_000).toISOString();
  assert.throws(() => acceptTimestampedPackage(state, { ...options, outcome }, pack.trust), /cal16_late_timestamp/);
  assert.throws(() => acceptTimestampedPackage(state, { ...options, outcome: { ...outcome, officialStart: undefined } }, pack.trust),
    /cal16_outcome/);
  assert.equal(readAccepted(state, pack.digest, pack.trust), null);
});

test("rejects corrupt content, replayed nonce and unauthorized TSA policy or signer", t => {
  const { state, pack, options, otherRequest, noNonce } = setup(t);
  assert.throws(() => verifyTimestamp({ ...options, packageBytes: Buffer.concat([pack.blob, Buffer.from(" ")]) }),
    /cal16_package_binding/);
  assert.throws(() => verifyTimestamp({ ...options, request: otherRequest }), /cal16_signature_or_nonce/);
  assert.throws(() => verifyTimestamp({ ...options, request: noNonce }), /cal16_query_profile/);
  assert.throws(() => verifyTimestamp({ ...options, authority: { ...options.authority, policyOid: "1.3.6.1.4.1.55555.99" } }),
    /cal16_response_profile/);
  assert.throws(() => verifyTimestamp({ ...options, authority: { ...options.authority, maxAccuracyMs: 1000 } }), /cal16_accuracy/);
  assert.throws(() => verifyTimestamp({ ...options, authority: { ...options.authority, signerFingerprint256: "00:".repeat(31) + "00" } }),
    /cal16_signer_pin/);
  assert.throws(() => acceptTimestampedPackage(state, options, { ...pack.trust, origin: "historical" }), /cal16_authority_origin/);
  assert.equal(readAccepted(state, pack.digest, pack.trust), null);
});

test("a changed signed time or corrupted token signature fails cryptographic verification", t => {
  const { options } = setup(t);
  const changedClock = Buffer.from(options.response);
  const stamp = /20\d{12}(?:\.\d+)?Z/.exec(changedClock.toString("latin1"));
  assert.ok(stamp, "TSTInfo generalized time");
  const digit = stamp.index + 13;
  changedClock[digit] = changedClock[digit] === 0x30 ? 0x31 : 0x30;
  assert.throws(() => verifyTimestamp({ ...options, response: changedClock }), /cal16_signature_or_nonce/);
  const brokenSignature = Buffer.from(options.response);
  brokenSignature[brokenSignature.length - 1] ^= 1;
  assert.throws(() => verifyTimestamp({ ...options, response: brokenSignature }), /cal16_signature_or_nonce/);
});
