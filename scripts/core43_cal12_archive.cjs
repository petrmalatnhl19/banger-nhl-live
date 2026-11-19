"use strict";

const { createHash, createPublicKey, sign, verify } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { COEFFICIENTS } = require("./core43_cal03_capture_plan.cjs");
const { planSignedExport } = require("./core43_cal07_export.cjs");
const { finalOutcome, predictionDigest, validatePrediction } = require("./core43_cal11_evaluate.cjs");

const CAPTURE_SCHEMA = "core43_cal12_capture_v1";
const WITNESS_SCHEMA = "core43_cal12_witness_v1";
const DOMAIN = Buffer.from(WITNESS_SCHEMA + "\0");
const SHA = /^[a-f0-9]{64}$/;
const ORIGINS = ["historical", "simulation"];
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const id = value => typeof value === "string" && /^\d{10}$/.test(value);
const team = value => typeof value === "string" && /^[A-Z]{3}$/.test(value);
const publicEd25519 = key => key?.type === "public" && key.asymmetricKeyType === "ed25519";
const sha = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const message = statement => Buffer.concat([DOMAIN, Buffer.from(JSON.stringify(statement))]);

function requireValid(condition, reason) {
  if (!condition) throw Error("cal12_" + reason);
}

function prepareCapture({ bytes, signature, exportTrust, now, origin }) {
  requireValid(ORIGINS.includes(origin), "origin");
  const { exportSha256, result } = planSignedExport({ bytes, signature, trust: exportTrust, now, existing: [] });
  requireValid(result.ready, "incomplete_capture");
  const { gameId, kickoffAt, frozenAt, awayTeam, homeTeam, baseline } = result.variants[0].record;
  const prediction = {
    origin, gameId, kickoffAt, frozenAt, awayTeam, homeTeam, core42: baseline,
    variants: result.variants.map(({ record: { coefficient, inputAsOf, predictedAt, away, home } }) =>
      ({ coefficient, inputAsOf, predictedAt, away, home })),
  };
  requireValid(!validatePrediction(prediction), "forecast_shape");
  return {
    schema: CAPTURE_SCHEMA, source: exportTrust.source, exportKeyId: exportTrust.keyId, exportSha256,
    variantHashes: result.variants.map(variant => variant.sha256),
    prediction,
  };
}

function validWitnessTime(prediction, observedAt) {
  return instant(observedAt) && observedAt >= prediction.frozenAt && observedAt < prediction.kickoffAt &&
    Date.parse(observedAt) - Date.parse(prediction.frozenAt) <= 5 * 60_000;
}

// Execute on the independent witness side. Its configured clock and key are
// outside the producer's trust boundary. The caller never supplies observedAt.
function attestCapture({
  capture, bytes, signature, exportTrust, origin, witnessId, privateKey, clock = () => new Date().toISOString(),
}) {
  requireValid(privateKey?.type === "private" && privateKey.asymmetricKeyType === "ed25519" &&
    publicEd25519(exportTrust?.publicKey) && !createPublicKey(privateKey).equals(exportTrust.publicKey) &&
    typeof witnessId === "string" && witnessId.length > 0, "witness_key");
  const reconstructed = prepareCapture({ bytes, signature, exportTrust, now: capture?.prediction?.frozenAt, origin });
  requireValid(sha(reconstructed) === sha(capture), "capture_mismatch");
  const observedAt = clock();
  requireValid(validWitnessTime(reconstructed.prediction, observedAt), "witness_time");
  const statement = { schema: WITNESS_SCHEMA, witnessId, captureSha256: sha(reconstructed), observedAt };
  return { statement, signature: sign(null, message(statement), privateKey).toString("base64url") };
}

function validateTrust(trust) {
  requireValid(ORIGINS.includes(trust?.origin) && typeof trust.witnessId === "string" && trust.witnessId &&
    typeof trust.exportTrust?.source === "string" && trust.exportTrust.source &&
    typeof trust.exportTrust.keyId === "string" && trust.exportTrust.keyId &&
    publicEd25519(trust.witnessKey) && publicEd25519(trust.exportTrust.publicKey) &&
    !trust.witnessKey.equals(trust.exportTrust.publicKey), "trust");
}

function verifyCapture(capture, receipt, trust) {
  validateTrust(trust);
  requireValid(capture?.schema === CAPTURE_SCHEMA && capture.source === trust.exportTrust.source &&
    capture.exportKeyId === trust.exportTrust.keyId && typeof capture.exportSha256 === "string" &&
    SHA.test(capture.exportSha256) && capture.prediction?.origin === trust.origin &&
    !validatePrediction(capture.prediction) && Array.isArray(capture.variantHashes) &&
    capture.variantHashes.length === capture.prediction.variants.length &&
    capture.variantHashes.every(hash => typeof hash === "string" && SHA.test(hash)), "invalid_capture");
  const { statement, signature } = receipt ?? {};
  requireValid(statement?.schema === WITNESS_SCHEMA && statement.witnessId === trust.witnessId &&
    statement.captureSha256 === sha(capture) && validWitnessTime(capture.prediction, statement.observedAt) &&
    typeof signature === "string" && /^[A-Za-z0-9_-]{86}$/.test(signature), "witness_receipt");
  const signed = Buffer.from(signature, "base64url");
  requireValid(signed.toString("base64url") === signature &&
    verify(null, message(statement), trust.witnessKey, signed), "witness_signature");
  return {
    gameId: capture.prediction.gameId, sha256: predictionDigest(capture.prediction), observedAt: statement.observedAt,
    archiveRef: `cal12:${trust.witnessId}:${statement.captureSha256}`,
  };
}

function readiness({ schedule, archives, outcomes, trust }) {
  validateTrust(trust);
  requireValid([schedule, archives, outcomes].every(Array.isArray), "inputs");
  const expected = new Map();
  for (const game of schedule) {
    requireValid(id(game?.gameId) && instant(game.kickoffAt) && team(game.awayTeam) &&
      team(game.homeTeam) && game.awayTeam !== game.homeTeam && !expected.has(game.gameId), "schedule");
    expected.set(game.gameId, game);
  }
  const byGame = new Map();
  let outsideScopeCaptures = 0;
  let duplicateCaptureRows = 0;
  const seenEntries = new Set();
  for (const entry of archives) {
    const prediction = entry?.capture?.prediction;
    if (!expected.has(prediction?.gameId) || prediction.origin !== trust.origin) {
      outsideScopeCaptures++;
      continue;
    }
    const digest = sha(entry);
    if (seenEntries.has(digest)) { duplicateCaptureRows++; continue; }
    seenEntries.add(digest);
    const entries = byGame.get(prediction.gameId) ?? [];
    entries.push(entry);
    byGame.set(prediction.gameId, entries);
  }
  const finals = new Map();
  for (const row of outcomes) {
    if (row?.origin !== trust.origin) continue;
    const game = String(row?.boxscore?.id);
    finals.set(game, finals.has(game) ? null : row);
  }

  const games = [];
  const counts = { expectedGames: expected.size, receivedCaptureRows: archives.length, outsideScopeCaptures, duplicateCaptureRows,
    gamesWithCapture: byGame.size, verifiedCaptures: 0, verifiedCore43Variants: 0, verifiedCore42Baselines: 0,
    missingCapture: 0, incompleteForecasts: 0, missingWitness: 0, invalidCapture: 0, conflictingCapture: 0, awaitingFinal: 0,
    invalidFinal: 0, notBeforeActualStart: 0, pairedGames: 0, winnerReadyGames: 0, probabilityReadyGames: 0 };

  function record(gameId, status) {
    counts[status]++;
    games.push({ gameId, status });
  }
  for (const [gameId, game] of expected) {
    const entries = byGame.get(gameId);
    if (!entries) { record(gameId, "missingCapture"); continue; }
    if (entries.length !== 1) { record(gameId, "conflictingCapture"); continue; }
    const [{ capture, receipt }] = entries;
    const prediction = capture.prediction;
    if (["kickoffAt", "awayTeam", "homeTeam"].some(field => prediction[field] !== game[field])) {
      record(gameId, "invalidCapture"); continue;
    }
    if (!prediction.core42 || !Array.isArray(prediction.variants) ||
        !COEFFICIENTS.every(coefficient => prediction.variants.some(variant => variant?.coefficient === coefficient))) {
      record(gameId, "incompleteForecasts"); continue;
    }
    if (!receipt) { record(gameId, "missingWitness"); continue; }
    let evidence;
    try { evidence = verifyCapture(capture, receipt, trust); }
    catch { record(gameId, "invalidCapture"); continue; }
    counts.verifiedCaptures++;
    counts.verifiedCore42Baselines++;
    counts.verifiedCore43Variants += prediction.variants.length;
    if (!finals.has(gameId)) { record(gameId, "awaitingFinal"); continue; }
    const actual = finalOutcome(finals.get(gameId), trust.origin);
    if (!actual || actual.kickoff !== game.kickoffAt || actual.awayTeam !== game.awayTeam || actual.homeTeam !== game.homeTeam) {
      record(gameId, "invalidFinal"); continue;
    }
    if (evidence.observedAt >= actual.startedAt) { record(gameId, "notBeforeActualStart"); continue; }
    record(gameId, "pairedGames");
    const models = [prediction.core42, ...prediction.variants];
    if (models.every(model => model.away !== model.home)) counts.winnerReadyGames++;
    if (models.every(model => model.homeWinProbability !== undefined)) counts.probabilityReadyGames++;
  }

  return { origin: trust.origin, counts, games };
}

if (require.main === module) {
  try {
    const paths = process.argv.slice(2);
    requireValid(paths.length === 4, "usage");
    const [schedule, archives, outcomes, config] = paths.map(path => JSON.parse(readFileSync(path, "utf8")));
    const { origin, witnessId, witnessPublicKey, exportTrust } = config;
    const trust = {
      origin, witnessId, witnessKey: createPublicKey(witnessPublicKey),
      exportTrust: { source: exportTrust.source, keyId: exportTrust.keyId, publicKey: createPublicKey(exportTrust.publicKey) },
    };
    console.log(JSON.stringify(readiness({ schedule, archives, outcomes, trust }), null, 2));
  } catch (error) {
    console.error(/^cal12_[a-z_]+$/.test(error.message) ? error.message : "cal12_invalid_input_files");
    process.exitCode = 1;
  }
}

module.exports = { prepareCapture, attestCapture, verifyCapture, readiness };
