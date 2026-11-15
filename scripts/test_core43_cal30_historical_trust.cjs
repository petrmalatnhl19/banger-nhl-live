"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { createHash, generateKeyPairSync, sign, X509Certificate } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { setTimeout } = require("node:timers/promises");
const { test } = require("node:test");
const { prepare, load } = require("./core43_cal14_rehearsal.cjs");
const { verifyTimestamp } = require("./core43_cal16_timestamp.cjs");
const { verifyHistoricalPrediction: run } = require("./core43_cal30_historical_trust.cjs");

const POLICY_OID = "1.3.6.1.4.1.55555.30";
const json = object => Buffer.from(JSON.stringify(object));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const publicDer = key => key.export({ type: "spki", format: "der" }).toString("base64url");
const iso = time => new Date(time).toISOString();

function makeTsa(directory, id) {
  mkdirSync(directory);
  const openssl = args => execFileSync("openssl", args, { cwd: directory, stdio: "pipe" });
  const write = (name, data) => writeFileSync(join(directory, name), data);
  const read = name => readFileSync(join(directory, name));
  const caExtensions = ["-addext", "basicConstraints=critical,CA:TRUE",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash"];
  const issue = (name, issuer) => openssl(["x509", "-req", "-days", "3", "-CA", issuer + ".pem",
    "-CAkey", issuer + ".key", "-CAcreateserial", "-copy_extensions", "copy", "-in", name + ".csr",
    "-out", name + ".pem"]);
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "3", "-subj", "/CN=" + id + "-root",
    ...caExtensions, "-out", "root.pem", "-keyout", "root.key"]);
  openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=" + id + "-issuer",
    ...caExtensions, "-out", "issuer.csr", "-keyout", "issuer.key"]);
  issue("issuer", "root");
  openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-subj", "/CN=" + id + "-leaf",
    "-addext", "basicConstraints=critical,CA:FALSE", "-addext", "keyUsage=critical,digitalSignature",
    "-addext", "extendedKeyUsage=critical,timeStamping", "-out", "leaf.csr", "-keyout", "leaf.key"]);
  issue("leaf", "issuer");
  for (const name of ["issuer", "root"]) {
    write(name + ".index", "");
    write(name + ".cnf", `[ca]
default_ca = ca_local
[ca_local]
database = ${name}.index
certificate = ${name}.pem
private_key = ${name}.key
default_md = sha256
default_crl_days = 2
`);
  }

  function crl(issuer, start, end, revoked) {
    const args = ["ca", "-config", issuer + ".cnf"];
    if (revoked) openssl([...args, "-revoke", revoked + ".pem", "-crl_reason", "keyCompromise"]);
    const opensslTime = ms => iso(ms).replace(/[-:]/g, "").replace("T", "").replace(".000", "");
    return openssl([...args, "-gencrl", "-crl_lastupdate", opensslTime(start), "-crl_nextupdate", opensslTime(end)]);
  }

  write("serial", "01\n");
  write("tsa.cnf", `[tsa]
default_tsa = tsa_local
[tsa_local]
serial = serial
signer_cert = leaf.pem
signer_key = leaf.key
certs = issuer.pem
signer_digest = sha256
default_policy = ${POLICY_OID}
digests = sha256
accuracy = secs:1
clock_precision_digits = 0
ordering = no
tsa_name = yes
ess_cert_id_chain = no
ess_cert_id_alg = sha256
`);
  function evidence(packageBytes, start, end) {
    write("package", packageBytes);
    openssl(["ts", "-query", "-data", "package", "-sha256", "-cert", "-out", "request.tsq"]);
    openssl(["ts", "-reply", "-config", "tsa.cnf", "-queryfile", "request.tsq", "-out", "response.tsr"]);
    return { id, chain: ["leaf.pem", "issuer.pem", "root.pem"].map(read),
      crls: [crl("issuer", start, end), crl("root", start, end)],
      approval: Buffer.from("synthetic review record for " + id),
      request: read("request.tsq"), response: read("response.tsr") };
  }
  return { evidence, crl };
}

async function setup(t) {
  const directory = mkdtempSync(join(tmpdir(), "cal30-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const epoch = Math.floor(Date.now() / 1000) * 1000;
  const exchange = join(directory, "exchange");
  const pins = prepare(exchange, iso(epoch - 90_000));
  const pack = load(exchange, pins.digest, pins.rootFingerprint);
  const registryBytes = json(pack.registry);
  const observer = generateKeyPairSync("ed25519");
  const issuers = ["alpha-tsa", "bravo-tsa"].map(id => makeTsa(join(directory, id), id));
  // Put the entire uncertainty interval after the certificates' notBefore values.
  await setTimeout(2200);
  const start = epoch - 30_000;
  const end = epoch + 300_000;
  const timestamps = issuers.map(issuer => issuer.evidence(pack.blob, start, end));
  const policy = {
    schema: "core43_cal30_policy_v1", mode: "simulation", reviewAt: iso(epoch + 240_000),
    packageRegistry: { source: pack.trust.source, rootKey: publicDer(pack.trust.rootKey), registrySha256: sha(registryBytes) },
    nhlObserver: { operatorId: "observer-operator", publicKey: publicDer(observer.publicKey) },
    authorities: timestamps.map(proof => ({
      id: proof.id, operatorId: proof.id + "-operator", policyOid: POLICY_OID, maxAccuracyMs: 1000,
      approvalSha256: sha(proof.approval), crlSha256: proof.crls.map(sha),
      chainSha256: proof.chain.map(bytes => sha(new X509Certificate(bytes).raw)),
    })),
  };
  const report = Buffer.from("Synthetic Game Summary for testing only");
  const { gameId, kickoffAt, awayTeam, homeTeam } = JSON.parse(pack.blob).capture.prediction;
  const schema = "core43_cal30_nhl_start_v1";
  const nhlStart = (overrides = {}, key = observer.privateKey) => {
    const statement = json({ schema, gameId, kickoffAt, awayTeam, homeTeam,
      url: "https://www.nhl.com/scores/htmlreports/20262027/GS029999.HTM", reportSha256: sha(report),
      actualStartAt: iso(epoch + 60_000), precision: "second", observedAt: iso(epoch + 120_000), ...overrides });
    return { report, statement, signature: sign(null, Buffer.concat([Buffer.from(schema + "\0"), statement]), key) };
  };
  return { issuers, start, end, epoch, policy, nhlStart,
    evidence: { packageBytes: pack.blob, registryBytes, timestamps, nhlStart: nhlStart() } };
}

function config(policy) {
  const policyBytes = json(policy);
  return { policyBytes, policySha256: sha(policyBytes) };
}

function rejects(evidence, verifierConfig, reason) {
  assert.deepEqual(run(evidence, verifierConfig), { trusted: false, status: "rejected", reason });
}

test("CAL-30 offline corroboration of signed predictions", async t => {
  const { policy, evidence, nhlStart, issuers, start, end, epoch } = await setup(t);
  const pinned = config(policy);
  const [alpha, bravo] = evidence.timestamps;
  const withBravo = replacement => ({ ...evidence, timestamps: [alpha, { ...bravo, ...replacement }] });

  await t.test("two valid RFC 3161 responses, complete signed CRLs and a signed game start remain simulation", () => {
    const result = run(evidence, pinned);
    assert.equal(result.status, "simulation_verified", JSON.stringify(result));
    assert.equal(result.trusted, false);
    assert.equal(result.digest, sha(evidence.packageBytes));
    assert.equal(result.cutoffAt, iso(epoch + 60_000));
    assert.equal(result.reviewedAt, policy.reviewAt);
    assert.equal(result.policySha256, pinned.policySha256);
    assert.deepEqual(run({ ...evidence, timestamps: [bravo, alpha] }, pinned), result);
  });

  await t.test("missing policy, changed policy and simulation relabeled as historical fail closed", () => {
    rejects(evidence, undefined, "cal30_policy_pin");
    const historical = config({ ...policy, mode: "historical" });
    rejects(evidence, { ...historical, policySha256: pinned.policySha256 }, "cal30_policy_pin");
    rejects(evidence, historical, "cal13_registry");
    rejects({ ...evidence, registryBytes: Buffer.from("{}") }, pinned, "cal30_registry_pin");
    const alteredPackage = JSON.parse(evidence.packageBytes);
    alteredPackage.receipt.signature = "A".repeat(86);
    rejects({ ...evidence, packageBytes: json(alteredPackage) }, pinned, "cal12_witness_signature");
  });

  await t.test("operator aliases, a reused certificate key and an observer in the package registry fail closed", () => {
    const [first, second] = policy.authorities;
    const duplicateOperator = { ...second, operatorId: first.operatorId };
    rejects(evidence, config({ ...policy, authorities: [first, duplicateOperator] }), "cal30_operator_independence");
    const sharedChain = { ...second, chainSha256: first.chainSha256 };
    rejects(withBravo({ chain: alpha.chain }), config({ ...policy, authorities: [first, sharedChain] }), "cal30_shared_key");
    const [publisher] = JSON.parse(evidence.registryBytes).body.keys;
    rejects(evidence, config({ ...policy, nhlObserver: { ...policy.nhlObserver, publicKey: publisher.publicKey } }),
      "cal30_observer_independence");
  });

  await t.test("an absent or substituted second authority is rejected", () => {
    rejects({ ...evidence, timestamps: [alpha, alpha] }, pinned, "cal30_timestamps");
    rejects(withBravo({ approval: Buffer.from("unapproved") }), pinned, "cal30_tsa_approval");
    rejects(withBravo({ chain: [bravo.chain[0], bravo.chain[1], alpha.chain[2]] }), pinned, "cal30_certificate_pin");
    rejects(withBravo({ request: alpha.request }), pinned, "cal16_signature_or_nonce");
  });

  await t.test("NHL signature, raw report and same-game UTC evidence are mandatory", () => {
    rejects({ ...evidence, nhlStart: undefined }, pinned, "cal30_nhl_statement");
    rejects({ ...evidence, nhlStart: nhlStart({}, generateKeyPairSync("ed25519").privateKey) }, pinned, "cal30_nhl_signature");
    rejects({ ...evidence, nhlStart: { ...nhlStart(), report: Buffer.from("modified HTML") } }, pinned, "cal30_nhl_binding");
    for (const mismatch of [{ gameId: "2026020001" }, { awayTeam: "BOS" }, { kickoffAt: iso(epoch) },
      { url: "https://example.org/GS029999.HTM" }, { precision: "minute", actualStartAt: iso(epoch + 1234) },
      { observedAt: iso(epoch + 250_000) }]) {
      rejects({ ...evidence, nhlStart: nhlStart(mismatch) }, pinned, "cal30_nhl_binding");
    }
  });

  await t.test("uses the earlier actual start including the minute floor and strict equality", () => {
    const minute = Math.floor(epoch / 60_000) * 60_000;
    const rounded = nhlStart({ actualStartAt: iso(minute), precision: "minute" });
    rejects({ ...evidence, nhlStart: rounded }, pinned, "cal30_timestamp_order");
    const [leaf, , root] = alpha.chain;
    const interval = verifyTimestamp({ ...alpha, packageBytes: evidence.packageBytes, authority: {
      kind: "independent", caPem: root, signerFingerprint256: new X509Certificate(leaf).fingerprint256,
      policyOid: POLICY_OID, maxAccuracyMs: 1000,
    } });
    rejects({ ...evidence, nhlStart: nhlStart({ actualStartAt: iso(interval.latestMs) }) }, pinned, "cal30_timestamp_order");
  });

  await t.test("missing, unpinned, wrong issuer, stale and revoked CRLs fail closed", () => {
    const useCrls = (leafCrl, issuerCrl = bravo.crls[1]) => {
      const [first, second] = policy.authorities;
      const crls = [leafCrl, issuerCrl];
      rejects(withBravo({ crls }), config({ ...policy, authorities: [first, { ...second, crlSha256: crls.map(sha) }] }),
        "cal30_certificate_status");
    };
    rejects(withBravo({ crls: [] }), pinned, "cal30_crl_missing");
    rejects(withBravo({ crls: [alpha.crls[0], bravo.crls[1]] }), pinned, "cal30_crl_pin");
    useCrls(alpha.crls[0]);
    const der = Buffer.from(bravo.crls[0].toString().split("\n").slice(1, -2).join(""), "base64");
    der[der.length - 1] ^= 1;
    const lines = der.toString("base64").match(/.{1,64}/g).join("\n");
    useCrls(Buffer.from(`-----BEGIN X509 CRL-----\n${lines}\n-----END X509 CRL-----\n`));
    useCrls(issuers[1].crl("issuer", start, epoch + 180_000));
    useCrls(issuers[1].crl("issuer", epoch + 180_000, end));
    useCrls(issuers[1].crl("issuer", start, end, "leaf"));
    useCrls(bravo.crls[0], issuers[1].crl("root", start, end, "issuer"));
  });
});
