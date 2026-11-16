"use strict";

const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { MAX_PACKAGE_BYTES } = require("./core43_cal13_coordinator.cjs");
const { verifyHistoricalPrediction } = require("./core43_cal30_historical_trust.cjs");

const SHA256 = /^[a-f0-9]{64}$/;
const SCHEMA = "core43_cal31_dossier_v1";
const MAX_DOSSIER_BYTES = 16 * 1024 * 1024;

function check(condition) {
  if (!condition) throw Error("cal31_dossier_format");
}

function fields(object, names) {
  return object && typeof object === "object" && !Array.isArray(object) &&
    Object.keys(object).length === names.length && names.every(name => Object.hasOwn(object, name));
}

function decode(value, limit) {
  check(typeof value === "string" && value.length > 0 && value.length <= Math.ceil(limit * 4 / 3) &&
    /^[A-Za-z0-9_-]+$/.test(value));
  const bytes = Buffer.from(value, "base64url");
  check(bytes.length <= limit && bytes.toString("base64url") === value);
  return bytes;
}

function decodeDossier(bytes, technical = false) {
  check(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_DOSSIER_BYTES);
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const dossier = JSON.parse(text);
  check(JSON.stringify(dossier) === text);
  const coreFields = ["schema", "packageBytes", "registryBytes", "timestamps"];
  check(fields(dossier, technical ? coreFields : [...coreFields, "nhlStart"]) &&
    dossier.schema === (technical ? "core43_cal36_dossier_v1" : SCHEMA) &&
    (technical || fields(dossier.nhlStart, ["report", "statement", "signature"])) &&
    Array.isArray(dossier.timestamps) && dossier.timestamps.length === 2);
  const { nhlStart } = dossier;
  return {
    packageBytes: decode(dossier.packageBytes, MAX_PACKAGE_BYTES),
    registryBytes: decode(dossier.registryBytes, 64 * 1024),
    ...(!technical && { nhlStart: {
      report: decode(nhlStart.report, 2 * 1024 * 1024),
      statement: decode(nhlStart.statement, 4096),
      signature: decode(nhlStart.signature, 64),
    } }),
    timestamps: dossier.timestamps.map(entry => {
      check(fields(entry, ["id", "request", "response", "chain", "crls", "approval"]) &&
        typeof entry.id === "string" && /^[a-z0-9][a-z0-9-]{2,63}$/.test(entry.id) &&
        Array.isArray(entry.chain) && entry.chain.length >= 2 && entry.chain.length <= 5 &&
        Array.isArray(entry.crls) && entry.crls.length === entry.chain.length - 1);
      return {
        id: entry.id,
        request: decode(entry.request, 4096),
        response: decode(entry.response, 128 * 1024),
        chain: entry.chain.map(cert => decode(cert, 16 * 1024)),
        crls: entry.crls.map(crl => decode(crl, 1024 * 1024)),
        approval: decode(entry.approval, 128 * 1024),
      };
    }),
  };
}

function replay({ dossierPath, policyPath, expectedPolicySha256 } = {}) {
  if (typeof expectedPolicySha256 !== "string" || !SHA256.test(expectedPolicySha256)) {
    return { trusted: false, status: "rejected", reason: "cal31_policy_pin_required" };
  }
  let dossierBytes, policyBytes;
  try {
    policyBytes = readBoundedFile(policyPath, 64 * 1024);
    dossierBytes = readBoundedFile(dossierPath, MAX_DOSSIER_BYTES);
  } catch {
    return { trusted: false, status: "rejected", reason: "cal31_input_file" };
  }
  let evidence;
  try {
    evidence = decodeDossier(dossierBytes);
  } catch {
    return { trusted: false, status: "rejected", reason: "cal31_dossier_format" };
  }
  return verifyHistoricalPrediction(evidence, { policyBytes, policySha256: expectedPolicySha256 });
}

if (require.main === module) {
  const [dossierPath, policyPath, expectedPolicySha256] = process.argv.slice(2);
  const result = process.argv.length === 5 ? replay({ dossierPath, policyPath, expectedPolicySha256 }) :
    { trusted: false, status: "rejected", reason: "cal31_usage" };
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exitCode = result.trusted ? 0 : 1;
}

module.exports = { replay, decodeDossier, MAX_DOSSIER_BYTES };
