"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { generateKeyPairSync, sign } = require("node:crypto");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { test } = require("node:test");
const { attestCapture, prepareCapture, readiness, verifyCapture } = require("./core43_cal12_archive.cjs");
const { evaluate, predictionDigest } = require("./core43_cal11_evaluate.cjs");
const { at, fixture, now, signed } = require("./fixtures/core43_signed_export.cjs");

const witness = generateKeyPairSync("ed25519");
const witnessId = "independent-fixture-witness";
const seen = at("22:01");

function setup(gameId = "2026020293", origin = "simulation") {
  const { bytes, signature, trust: exportTrust } = signed(fixture(now, { gameId }));
  const data = { bytes, signature, exportTrust, origin, now };
  const capture = prepareCapture(data);
  const trust = { origin, witnessId, exportTrust, witnessKey: witness.publicKey };
  const witnessInput = { ...data, capture, witnessId, privateKey: witness.privateKey, clock: () => seen };
  const receipt = attestCapture(witnessInput);
  const { awayTeam, homeTeam, kickoffAt } = capture.prediction;
  const schedule = { gameId, awayTeam, homeTeam, kickoffAt };
  const final = {
    origin, sourceUrl: origin === "simulation" ? "fixture" : `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`,
    boxscore: {
      id: Number(gameId), startTimeUTC: kickoffAt.replace(".000Z", "Z"),
      gameState: "OFF", gameOutcome: { lastPeriodType: "SO" },
      awayTeam: { abbrev: awayTeam, score: 3 }, homeTeam: { abbrev: homeTeam, score: 2 },
    },
  };
  if (origin === "historical") final.officialStart = {
    at: at("23:07"), url: `https://www.nhl.com/scores/htmlreports/20262027/GS${gameId.slice(4)}.HTM`,
  };
  return { capture, receipt, schedule, final, trust, data, witnessInput };
}

test("the signed witness binds all four variants to their exact CAL-07 export and feeds CAL-11", () => {
  const item = setup();
  assert.deepEqual(item.capture.prediction.variants.map(v => v.coefficient), [0, 0.005, 0.02, 0.03]);
  assert.equal(item.capture.variantHashes.length, 4);
  const proof = verifyCapture(item.capture, item.receipt, item.trust);
  assert.equal(proof.observedAt, seen);
  assert.equal(proof.sha256, predictionDigest(item.capture.prediction));
  const evaluated = evaluate({ predictions: [item.capture.prediction], evidence: [proof], outcomes: [item.final] });
  assert.deepEqual(evaluated.cohorts.map(c => c.pairedGames), [0, 1, 0]);
  assert.equal(evaluated.cohorts[1].probabilityGameIds.length, 0);
});

test("the witness reproduces the forecast and independently rejects a late or backdated claimed capture", () => {
  const s = setup();
  const modified = structuredClone(s.capture);
  modified.prediction.variants[1].away += 0.1;
  assert.throws(() => attestCapture({ ...s.witnessInput, capture: modified }), /cal12_capture_mismatch/);
  assert.throws(() => attestCapture({ ...s.witnessInput, clock: () => at("21:59") }), /cal12_witness_time/);
  assert.throws(() => attestCapture({ ...s.witnessInput, clock: () => at("22:06") }), /cal12_witness_time/);
  assert.throws(() => attestCapture({ ...s.witnessInput, clock: () => s.schedule.kickoffAt }), /cal12_witness_time/);
  assert.throws(() => prepareCapture({ ...s.data, origin: "recomputed" }), /cal12_origin/);
  const badSource = Buffer.from(s.data.bytes);
  badSource[3] ^= 1;
  assert.throws(() => attestCapture({ ...s.witnessInput, bytes: badSource }), /cal07_signature/);
});

test("the verifier rejects changed data, forged times, a wrong witness and production relabeling", () => {
  const s = setup();
  const modified = structuredClone(s.capture);
  modified.prediction.variants[1].home += 0.02;
  assert.throws(() => verifyCapture(modified, s.receipt, s.trust), /cal12_witness_receipt/);
  const fakeTime = structuredClone(s.receipt);
  fakeTime.statement.observedAt = at("22:02");
  assert.throws(() => verifyCapture(s.capture, fakeTime, s.trust), /cal12_witness_signature/);
  const impostor = generateKeyPairSync("ed25519");
  const fakeSignature = sign(null, Buffer.concat([Buffer.from("core43_cal12_witness_v1\0"),
    Buffer.from(JSON.stringify(s.receipt.statement))]), impostor.privateKey).toString("base64url");
  assert.throws(() => verifyCapture(s.capture, { ...s.receipt, signature: fakeSignature }, s.trust), /cal12_witness_signature/);
  assert.throws(() => verifyCapture(s.capture, s.receipt, { ...s.trust, witnessKey: s.trust.exportTrust.publicKey }), /cal12_trust/);
  assert.throws(() => verifyCapture(s.capture, s.receipt, { ...s.trust, origin: "historical" }), /cal12_invalid_capture/);
});

test("coverage counts missing captures, variants, witnesses and results without mixing simulated cohorts", () => {
  const [paired, waiting, unsigned, partial, missing] = ["2026020293", "2026020294", "2026020295", "2026020296", "2026020297"]
    .map(gameId => setup(gameId));
  const shortened = structuredClone(partial.capture);
  shortened.prediction.variants.pop();
  const archives = [paired, waiting, { capture: unsigned.capture }, { capture: shortened, receipt: partial.receipt }]
    .map(({ capture, receipt }) => ({ capture, receipt }));
  archives.push(archives[0]);
  const result = readiness({ schedule: [paired, waiting, unsigned, partial, missing].map(x => x.schedule),
    archives, outcomes: [paired.final], trust: paired.trust });
  assert.equal(result.origin, "simulation");
  assert.deepEqual(result.counts, {
    expectedGames: 5, receivedCaptureRows: 5, outsideScopeCaptures: 0, duplicateCaptureRows: 1,
    gamesWithCapture: 4, verifiedCaptures: 2, verifiedCore43Variants: 8, verifiedCore42Baselines: 2,
    missingCapture: 1, incompleteForecasts: 1, missingWitness: 1, invalidCapture: 0, conflictingCapture: 0,
    awaitingFinal: 1, invalidFinal: 0, notBeforeActualStart: 0, pairedGames: 1, winnerReadyGames: 1, probabilityReadyGames: 0,
  });
});

test("historical pairing needs the official actual start and rejects duplicate or mismatched finals", () => {
  // Synthetic inputs exercise the historical gates without creating historical data.
  const s = setup("2026020293", "historical");
  const input = { schedule: [s.schedule], archives: [{ capture: s.capture, receipt: s.receipt }], trust: s.trust };
  assert.equal(readiness({ ...input, outcomes: [s.final] }).counts.pairedGames, 1);
  const missingStart = structuredClone(s.final);
  delete missingStart.officialStart;
  assert.equal(readiness({ ...input, outcomes: [missingStart] }).counts.invalidFinal, 1);
  const early = structuredClone(s.final);
  early.officialStart.at = seen;
  assert.equal(readiness({ ...input, outcomes: [early] }).counts.notBeforeActualStart, 1);
  const wrongTeam = structuredClone(s.final);
  wrongTeam.boxscore.homeTeam.abbrev = "BUF";
  assert.equal(readiness({ ...input, outcomes: [wrongTeam] }).counts.invalidFinal, 1);
  assert.equal(readiness({ ...input, outcomes: [s.final, s.final] }).counts.invalidFinal, 1);
  assert.throws(() => readiness({ ...input, schedule: [s.schedule, s.schedule], outcomes: [] }), /cal12_schedule/);
  assert.equal(readiness({ ...input, outcomes: [], trust: { ...s.trust, origin: "simulation" } }).counts.outsideScopeCaptures, 1);
});

test("offline CLI loads public keys and prints readiness without touching live systems", t => {
  const s = setup();
  const dir = mkdtempSync(join(tmpdir(), "cal12-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const pem = key => key.export({ type: "spki", format: "pem" });
  const paths = [[s.schedule], [{ capture: s.capture, receipt: s.receipt }], [s.final], {
    origin: s.trust.origin, witnessId, witnessPublicKey: pem(witness.publicKey),
    exportTrust: { ...s.trust.exportTrust, publicKey: pem(s.trust.exportTrust.publicKey) },
  }].map((value, index) => {
    const path = join(dir, `input-${index}.json`);
    writeFileSync(path, JSON.stringify(value));
    return path;
  });
  const stdout = execFileSync(process.execPath, [join(__dirname, "core43_cal12_archive.cjs"), ...paths], { encoding: "utf8" });
  assert.equal(JSON.parse(stdout).counts.pairedGames, 1);
  assert.equal(JSON.parse(stdout).counts.probabilityReadyGames, 0);
});

test("competing valid captures require resolution and changed schedules do not silently pair", () => {
  const s = setup();
  const secondCapture = prepareCapture({ ...s.data, now: seen });
  const secondReceipt = attestCapture({ ...s.witnessInput, capture: secondCapture, clock: () => at("22:02") });
  const first = { capture: s.capture, receipt: s.receipt };
  const result = readiness({ schedule: [s.schedule], archives: [first, { capture: secondCapture, receipt: secondReceipt }],
    outcomes: [s.final], trust: s.trust });
  assert.equal(result.counts.conflictingCapture, 1);
  assert.equal(result.counts.pairedGames, 0);
  const moved = { ...s.schedule, kickoffAt: at("23:15") };
  assert.equal(readiness({ schedule: [moved], archives: [first], outcomes: [], trust: s.trust }).counts.invalidCapture, 1);
});
