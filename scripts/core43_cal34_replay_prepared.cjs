"use strict";

const { createHash } = require("node:crypto");
const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { decodeDossier, MAX_DOSSIER_BYTES } = require("./core43_cal31_replay.cjs");
const { verifyHistoricalPrediction } = require("./core43_cal30_historical_trust.cjs");

const MAX_PREPARED_BYTES = 300 * 1024;
const MAX_POLICY_BYTES = 64 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = bytes => bytes.toString("base64url");
const validPin = pin => typeof pin === "string" && pin.length === 64 && /^[a-f0-9]+$/.test(pin);

function check(condition, reason) {
  if (!condition) throw Error("cal34_" + reason);
}

function fields(value, names) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function readPrepared(bytes, pin) {
  check(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_PREPARED_BYTES &&
    validPin(pin) && hash(bytes) === pin, "prepared_pin");
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes).replace(/\n$/, "");
  const prepared = JSON.parse(text);
  check(JSON.stringify(prepared) === text && fields(prepared, ["schema", "status", "trusted", "mode", "gameId",
    "kickoffAt", "preparedAt", "packageSha256", "planSha256", "packageBytes", "registryBytes", "requests"]) &&
    prepared.schema === "core43_cal32_pregame_requests_v1" && prepared.status === "requests_prepared" &&
    prepared.trusted === false && validPin(prepared.planSha256) && Array.isArray(prepared.requests) &&
    prepared.requests.length === 2, "prepared_format");
  return prepared;
}

function compareEvidence(prepared, evidence, policy) {
  check(prepared.packageSha256 === hash(evidence.packageBytes) &&
    prepared.packageBytes === encode(evidence.packageBytes), "package_mismatch");
  check(prepared.registryBytes === encode(evidence.registryBytes), "registry_mismatch");
  const prediction = JSON.parse(evidence.packageBytes).capture.prediction;
  check(prediction.gameId === prepared.gameId && prediction.kickoffAt === prepared.kickoffAt &&
    prediction.origin === prepared.mode, "game_mismatch");
  const byId = new Map(evidence.timestamps.map(proof => [proof.id, proof.request]));
  const policyById = new Map(policy.authorities.map(authority => [authority.id, authority.policyOid]));
  check(byId.size === 2 && policy.mode === prepared.mode && policyById.size === 2, "authority_mismatch");
  const seen = new Set();
  for (const entry of prepared.requests) {
    check(fields(entry, ["id", "policyOid", "requestSha256", "request"]) && !seen.has(entry.id) && byId.has(entry.id),
      "authority_mismatch");
    seen.add(entry.id);
    check(policyById.get(entry.id) === entry.policyOid && typeof entry.policyOid === "string", "authority_policy_mismatch");
    const bytes = byId.get(entry.id);
    check(entry.requestSha256 === hash(bytes) && entry.request === encode(bytes), "request_mismatch");
  }
}

function replayPrepared({ preparedBytes, expectedPreparedSha256, dossierBytes, policyBytes, expectedPolicySha256 } = {}) {
  try {
    const prepared = readPrepared(preparedBytes, expectedPreparedSha256);
    check(Buffer.isBuffer(policyBytes) && policyBytes.length > 0 && policyBytes.length <= MAX_POLICY_BYTES &&
      validPin(expectedPolicySha256) && hash(policyBytes) === expectedPolicySha256, "policy_pin");
    const evidence = decodeDossier(dossierBytes);
    compareEvidence(prepared, evidence, JSON.parse(policyBytes));
    const result = verifyHistoricalPrediction(evidence, { policyBytes, policySha256: expectedPolicySha256 });
    return { ...result, preparedSha256: expectedPreparedSha256, planSha256: prepared.planSha256 };
  } catch (error) {
    const reason = /^cal(?:31|34)_[a-z_]+$/.test(error?.message) ? error.message : "cal34_input_format";
    return { trusted: false, status: "rejected", reason };
  }
}

if (require.main === module) {
  let result;
  try {
    check(process.argv.length === 7, "usage");
    const [preparedPath, dossierPath, policyPath, expectedPreparedSha256, expectedPolicySha256] = process.argv.slice(2);
    result = replayPrepared({
      preparedBytes: readBoundedFile(preparedPath, MAX_PREPARED_BYTES),
      dossierBytes: readBoundedFile(dossierPath, MAX_DOSSIER_BYTES),
      policyBytes: readBoundedFile(policyPath, MAX_POLICY_BYTES),
      expectedPreparedSha256,
      expectedPolicySha256,
    });
  } catch (error) {
    result = { trusted: false, status: "rejected", reason: error.message === "cal34_usage" ? error.message : "cal34_input_file" };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.trusted ? 0 : 1;
}

module.exports = { replayPrepared };
