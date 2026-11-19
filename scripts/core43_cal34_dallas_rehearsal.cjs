"use strict";

// This runner only creates a retrospective simulation. The TSA clocks are real.
const assert = require("node:assert/strict");
const { createHash, generateKeyPairSync, X509Certificate } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { setTimeout } = require("node:timers/promises");
const { prepare, load } = require("./core43_cal14_rehearsal.cjs");
const { verifyTimestamp } = require("./core43_cal16_timestamp.cjs");
const { preparePregameRequests } = require("./core43_cal32_prepare_pregame.cjs");
const { attestNhlStart, verifyProvenance } = require("./core43_cal33_nhl_observer.cjs");
const { replayPrepared } = require("./core43_cal34_replay_prepared.cjs");
const { signArchiveReceipt } = require("./core43_cal35_archive_receipt.cjs");
const { makeTsa, POLICY_OID } = require("./fixtures/core43_local_tsa.cjs");

const json = value => Buffer.from(JSON.stringify(value));
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = bytes => bytes.toString("base64url");
const der = key => encode(key.export({ type: "spki", format: "der" }));
const iso = time => new Date(time).toISOString();

async function rehearse(sourcesBytes, review, out) {
  const sources = JSON.parse(sourcesBytes);
  const official = JSON.parse(Buffer.from(sources.boxscore.bytes, "base64url"));
  const { id, awayTeam, homeTeam } = official;
  assert.ok([awayTeam.abbrev, homeTeam.abbrev].includes("DAL"), "Expected a Dallas game");
  const kickoff = Date.parse(official.startTimeUTC);
  const simulatedCapture = kickoff - 60 * 60_000;
  const simulatedPreparation = simulatedCapture + 2 * 60_000;
  assert.ok(Date.now() > kickoff && Date.now() > Date.parse(review.actualStartAt), "Expected a completed past game");
  const work = mkdtempSync(join(tmpdir(), "cal34-dallas-"));
  try {
    const exchange = join(work, "exchange");
    const pins = prepare(exchange, iso(simulatedCapture), { gameId: String(id), away: awayTeam.abbrev, home: homeTeam.abbrev });
    const pack = load(exchange, pins.digest, pins.rootFingerprint);
    const registryBytes = json(pack.registry);
    const packageRegistry = { source: pack.trust.source, rootKey: der(pack.trust.rootKey), registrySha256: sha(registryBytes) };
    const profiles = ["alpha-tsa", "bravo-tsa"].map(id => ({ id, operatorId: id + "-test", policyOid: POLICY_OID }));
    const planBytes = json({ schema: "core43_cal32_pregame_plan_v1", mode: "simulation", gameId: String(id),
      kickoffAt: iso(kickoff), packageRegistry, authorities: profiles });
    // Only the preparation logic uses the explicitly simulated pregame clock.
    const prepared = preparePregameRequests({ packageBytes: pack.blob, registryBytes, planBytes,
      expectedPlanSha256: sha(planBytes) }, () => simulatedPreparation);
    const preparedBytes = Buffer.from(JSON.stringify(prepared) + "\n");
    const observer = generateKeyPairSync("ed25519");
    const attestation = attestNhlStart(sourcesBytes, review, observer.privateKey);
    assert.ok(verifyProvenance(sourcesBytes, attestation, observer.publicKey));
    const issuers = profiles.map(({ id }) => makeTsa(join(work, id), id));
    await setTimeout(2200);
    const epoch = Math.floor(Date.now() / 1000) * 1000;
    const timestamps = issuers.map((issuer, index) => {
      const proof = issuer.evidence(pack.blob, epoch - 60_000, epoch + 3600_000);
      proof.request = Buffer.from(prepared.requests[index].request, "base64url");
      proof.response = issuer.respond(proof.request);
      return proof;
    });
    const tokenOptions = (proof, index) => ({ packageBytes: pack.blob, request: proof.request, response: proof.response,
      authority: { kind: "test", policyOid: profiles[index].policyOid, maxAccuracyMs: 1000,
        caPem: proof.chain.at(-1), signerFingerprint256: new X509Certificate(proof.chain[0]).fingerprint256 } });
    const intervals = timestamps.map((proof, index) => {
      const options = tokenOptions(proof, index);
      const checked = verifyTimestamp(options);
      assert.equal(checked.digest, pins.digest);
      assert.ok(checked.earliestMs > Math.max(kickoff, Date.parse(review.actualStartAt)));
      assert.throws(() => verifyTimestamp({ ...options, request: timestamps[1 - index].request }),
        /cal16_signature_or_nonce/);
      assert.throws(() => verifyTimestamp({ ...options, packageBytes: Buffer.concat([pack.blob, Buffer.from(" ")]) }),
        /cal16_package_binding/);
      assert.throws(() => verifyTimestamp({ ...options, response: Buffer.from("invalid") }), /cal16_response/);
      return { id: proof.id, earliestAt: iso(checked.earliestMs), latestAt: iso(checked.latestMs), packageSha256: checked.digest };
    });
    const reviewAt = iso(Math.ceil(Date.now() / 1000) * 1000);
    const policy = { schema: "core43_cal30_policy_v1", mode: "simulation", reviewAt, packageRegistry,
      nhlObserver: { operatorId: "local-simulation-observer", publicKey: der(observer.publicKey) },
      authorities: timestamps.map((proof, index) => ({ ...profiles[index], maxAccuracyMs: 1000,
        approvalSha256: sha(proof.approval), crlSha256: proof.crls.map(sha),
        chainSha256: proof.chain.map(bytes => sha(new X509Certificate(bytes).raw)) })) };
    const dossier = { schema: "core43_cal31_dossier_v1", packageBytes: encode(pack.blob),
      registryBytes: encode(registryBytes), nhlStart: attestation.nhlStart,
      timestamps: timestamps.map(({ id, request, response, chain, crls, approval }) => ({
        id, request: encode(request), response: encode(response), chain: chain.map(encode),
        crls: crls.map(encode), approval: encode(approval),
      })) };
    const check = (reviewPolicy, evidence = dossier) => {
      const policyBytes = json(reviewPolicy);
      return replayPrepared({ preparedBytes, expectedPreparedSha256: sha(preparedBytes), dossierBytes: json(evidence),
        policyBytes, expectedPolicySha256: sha(policyBytes) });
    };
    const result = check(policy);
    assert.equal(result.trusted, false);
    assert.equal(result.reason, "cal30_timestamp_order");
    const reject = (actual, reason) => {
      assert.equal(actual.trusted, false);
      assert.equal(actual.reason, reason);
      return actual;
    };
    const independence = reject(check({ ...policy, authorities: [policy.authorities[0],
      { ...policy.authorities[1], operatorId: policy.authorities[0].operatorId }] }), "cal30_operator_independence");
    const relabel = reject(check({ ...policy, mode: "historical" }), "cal34_authority_mismatch");
    const swappedRequests = reject(check(policy, { ...dossier, timestamps: [
      { ...dossier.timestamps[0], request: dossier.timestamps[1].request }, dossier.timestamps[1],
    ] }), "cal34_request_mismatch");
    const custodian = generateKeyPairSync("ed25519");
    assert.throws(() => signArchiveReceipt(preparedBytes, "local:simulation", custodian.privateKey), /cal35_receipt_format/);
    const prediction = JSON.parse(pack.blob).capture.prediction;
    const evidenceSummary = { simulation: true, generatedAfterGame: true, completedAt: new Date().toISOString(),
      simulatedCaptureAt: iso(simulatedCapture), simulatedPreparationAt: iso(simulatedPreparation),
      sources: Object.fromEntries(["report", "boxscore"].map(key => {
        const { url, retrievedAt, sha256 } = sources[key];
        return [key, { url, retrievedAt, sha256 }];
      })), pins: { ...pins, preparedSha256: sha(preparedBytes), policySha256: sha(json(policy)) },
      tests: { tokenSignatureChainAndDigest: "passed for both", swappedNonce: "rejected for both",
        changedPackage: "rejected for both", invalidToken: "rejected for both", observerProvenance: "verified with disposable key",
        lateArchiveReceipt: "rejected at current clock", independence, relabel, swappedRequests }, intervals, result };
    mkdirSync(out, { mode: 0o700 });
    const write = (name, bytes) => writeFileSync(join(out, name), bytes, { flag: "wx", mode: 0o600 });
    write("test-prediction.json", json({ simulation: true, generatedAfterGame: true, prediction }));
    write("bundle.json", pack.blob);
    write("registry.json", registryBytes);
    write("root-public.pem", readFileSync(join(exchange, "root-public.pem")));
    write("observer-public.pem", observer.publicKey.export({ type: "spki", format: "pem" }));
    write("sources.json", sourcesBytes);
    write("attestation.json", json(attestation));
    write("preparation-plan.json", planBytes);
    write("prepared.json", preparedBytes);
    write("review-policy.json", json(policy));
    write("dossier.json", json(dossier));
    write("result.json", JSON.stringify(evidenceSummary, null, 2) + "\n");
    for (const proof of timestamps) {
      write(proof.id + ".tsq", proof.request);
      write(proof.id + ".tsr", proof.response);
      proof.chain.forEach((cert, index) => write(proof.id + "-cert-" + index + ".pem", cert));
    }
    return evidenceSummary;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (require.main === module) {
  const [sources, review, out] = process.argv.slice(2);
  if (!sources || !review || !out || process.argv.length !== 5) throw Error("Usage: rehearsal sources.json review.json output-directory");
  rehearse(readFileSync(sources), JSON.parse(readFileSync(review)), out).then(result => {
    process.stdout.write(JSON.stringify(result.result) + "\n");
  }).catch(error => { process.stderr.write(String(error) + "\n"); process.exitCode = 1; });
}

module.exports = { rehearse };
