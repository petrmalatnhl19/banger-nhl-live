"use strict";

const { execFileSync } = require("node:child_process");
const { createHash, createPublicKey, verify, X509Certificate } = require("node:crypto");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { readRegistry, verifyPackage } = require("./core43_cal13_coordinator.cjs");
const { verifyTimestamp } = require("./core43_cal16_timestamp.cjs");

const POLICY = "core43_cal30_policy_v1";
const NHL_START = "core43_cal30_nhl_start_v1";
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const OID = /^\d+(?:\.\d+){2,}$/;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const bounded = (bytes, max) => Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= max;
const matches = (pattern, value) => typeof value === "string" && pattern.test(value);
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const spki = key => hash(key.export({ type: "spki", format: "der" }));

function check(condition, reason) {
  if (!condition) throw Error("cal30_" + reason);
}

function fields(value, names) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function document(bytes, limit, reason) {
  check(bounded(bytes, limit), reason);
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const value = JSON.parse(text);
    check(JSON.stringify(value) === text, reason);
    return value;
  } catch {
    throw Error("cal30_" + reason);
  }
}

function ed25519(encoded, reason) {
  check(matches(/^[A-Za-z0-9_-]{59}$/, encoded), reason);
  const der = Buffer.from(encoded, "base64url");
  check(der.toString("base64url") === encoded, reason);
  try {
    const key = createPublicKey({ key: der, type: "spki", format: "der" });
    check(key.asymmetricKeyType === "ed25519" && key.export({ type: "spki", format: "der" }).equals(der), reason);
    return key;
  } catch {
    throw Error("cal30_" + reason);
  }
}

function readPolicy(bytes, pin) {
  // pin comes from verifier-owned configuration, never from the submitted evidence.
  check(bounded(bytes, 64 * 1024) && matches(SHA, pin) && hash(bytes) === pin, "policy_pin");
  const policy = document(bytes, 64 * 1024, "policy");
  check(fields(policy, ["schema", "mode", "reviewAt", "packageRegistry", "nhlObserver", "authorities"]) &&
    policy.schema === POLICY && ["simulation", "historical"].includes(policy.mode) && instant(policy.reviewAt) &&
    Date.parse(policy.reviewAt) % 1000 === 0 &&
    Array.isArray(policy.authorities) && policy.authorities.length === 2, "policy");
  const { packageRegistry, nhlObserver, authorities } = policy;
  check(fields(packageRegistry, ["source", "rootKey", "registrySha256"]) &&
    matches(SHA, packageRegistry.registrySha256) &&
    fields(nhlObserver, ["operatorId", "publicKey"]) && matches(ID, nhlObserver.operatorId), "policy");
  for (const profile of authorities) {
    check(fields(profile, ["id", "operatorId", "policyOid", "maxAccuracyMs", "approvalSha256",
      "chainSha256", "crlSha256"]) &&
      matches(ID, profile.id) && matches(ID, profile.operatorId) && matches(OID, profile.policyOid) &&
      Number.isSafeInteger(profile.maxAccuracyMs) && profile.maxAccuracyMs >= 0 &&
      matches(SHA, profile.approvalSha256) &&
      Array.isArray(profile.chainSha256) && profile.chainSha256.length >= 2 && profile.chainSha256.length <= 5 &&
      profile.chainSha256.every(pin => matches(SHA, pin)) &&
      Array.isArray(profile.crlSha256) && profile.crlSha256.length === profile.chainSha256.length - 1 &&
      profile.crlSha256.every(pin => matches(SHA, pin)), "tsa_profile");
  }
  check(new Set(authorities.map(profile => profile.id)).size === 2 &&
    new Set([nhlObserver.operatorId, ...authorities.map(profile => profile.operatorId)]).size === 3 &&
    new Set(authorities.map(profile => profile.approvalSha256)).size === 2, "operator_independence");
  return policy;
}

function verifyStart(evidence, observerKey, prediction, reviewAt) {
  const { report, statement, signature } = evidence ?? {};
  const record = document(statement, 4096, "nhl_statement");
  check(Buffer.isBuffer(signature) && signature.length === 64 &&
    verify(null, Buffer.concat([Buffer.from(NHL_START + "\0"), statement]), observerKey, signature), "nhl_signature");
  const { gameId, kickoffAt, awayTeam, homeTeam } = prediction;
  const season = Number(gameId.slice(0, 4));
  const url = `https://www.nhl.com/scores/htmlreports/${season}${season + 1}/GS${gameId.slice(4)}.HTM`;
  check(fields(record, ["schema", "gameId", "kickoffAt", "awayTeam", "homeTeam", "url", "reportSha256",
    "actualStartAt", "precision", "observedAt"]) && record.schema === NHL_START &&
    record.gameId === gameId && record.kickoffAt === kickoffAt &&
    record.awayTeam === awayTeam && record.homeTeam === homeTeam && record.url === url &&
    bounded(report, 2 * 1024 * 1024) && hash(report) === record.reportSha256 &&
    instant(record.actualStartAt) && instant(record.observedAt) &&
    ["second", "minute"].includes(record.precision) &&
    Date.parse(record.actualStartAt) % (record.precision === "minute" ? 60000 : 1000) === 0 &&
    record.actualStartAt < record.observedAt && record.observedAt <= reviewAt, "nhl_binding");
  return Math.min(Date.parse(kickoffAt), Date.parse(record.actualStartAt));
}

function readChain(profile, evidence, keys) {
  check(bounded(evidence.approval, 128 * 1024) && hash(evidence.approval) === profile.approvalSha256, "tsa_approval");
  check(Array.isArray(evidence.chain) && evidence.chain.length === profile.chainSha256.length, "certificate_chain");
  const chain = evidence.chain.map((bytes, index) => {
    check(bounded(bytes, 16 * 1024), "certificate_chain");
    const cert = new X509Certificate(bytes);
    check(hash(cert.raw) === profile.chainSha256[index] && cert.ca === (index > 0), "certificate_pin");
    const key = spki(cert.publicKey);
    check(!keys.has(key), "shared_key");
    keys.add(key);
    return cert;
  });
  for (const [index, cert] of chain.entries()) {
    const issuer = chain[index + 1] ?? cert;
    check(cert.checkIssued(issuer) && cert.verify(issuer.publicKey), "certificate_chain");
  }
  return chain;
}

function verifyRevocation(crls, profile, chain, interval, reviewAt) {
  check(Array.isArray(crls) && crls.length === profile.crlSha256.length, "crl_missing");
  for (const [index, crl] of crls.entries()) {
    check(bounded(crl, 1024 * 1024) && hash(crl) === profile.crlSha256[index] &&
      /^-----BEGIN X509 CRL-----\r?\n[A-Za-z0-9+/=\r\n]+-----END X509 CRL-----\r?\n?$/.test(crl.toString("latin1")),
    "crl_pin");
  }

  const dir = mkdtempSync(join(tmpdir(), "cal30-crl-"));
  try {
    const write = (name, bytes) => {
      const path = join(dir, name);
      writeFileSync(path, bytes, { flag: "wx", mode: 0o600 });
      return path;
    };
    const leaf = write("leaf.pem", chain[0].toString());
    const root = write("root.pem", chain.at(-1).toString());
    const bundle = write("crls.pem", Buffer.concat(crls.flatMap(crl => [crl, Buffer.from("\n")])));
    const intermediates = chain.slice(1, -1);
    const extra = intermediates.length ? ["-untrusted", write("issuers.pem", intermediates.join("\n"))] : [];
    // No default CA store, network lookup, delta CRLs or application-provided validation callbacks.
    const seconds = new Set([Math.floor(interval.earliestMs / 1000), Math.ceil(interval.latestMs / 1000),
      Date.parse(reviewAt) / 1000]);
    for (const time of seconds) {
      try {
        execFileSync("openssl", ["verify", "-trusted", root, ...extra, "-purpose", "timestampsign",
          "-x509_strict", "-auth_level", "2", "-check_ss_sig", "-crl_check_all", "-CRLfile", bundle,
          "-attime", String(time), leaf], {
          env: { PATH: process.env.PATH, LC_ALL: "C" }, timeout: 5000, maxBuffer: 64 * 1024,
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        throw Error("cal30_certificate_status");
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verifyHistoricalPrediction(evidence, { policyBytes, policySha256 } = {}) {
  try {
    const policy = readPolicy(policyBytes, policySha256);
    const { packageBytes, registryBytes, nhlStart, timestamps } = evidence ?? {};
    const rootKey = ed25519(policy.packageRegistry.rootKey, "registry_key");
    const observerKey = ed25519(policy.nhlObserver.publicKey, "observer_key");
    check(bounded(registryBytes, 64 * 1024) && hash(registryBytes) === policy.packageRegistry.registrySha256,
      "registry_pin");
    const trust = { origin: policy.mode, source: policy.packageRegistry.source, rootKey };
    const registry = readRegistry(document(registryBytes, 64 * 1024, "registry"), trust);
    const keys = new Set([spki(rootKey), ...Array.from(registry.keys.values(), entry => entry.fingerprint)]);
    check(!keys.has(spki(observerKey)), "observer_independence");
    keys.add(spki(observerKey));
    const { payload } = verifyPackage(packageBytes, registry, trust);
    const cutoffMs = verifyStart(nhlStart, observerKey, payload.capture.prediction, policy.reviewAt);

    check(Array.isArray(timestamps) && timestamps.length === 2, "timestamps");
    const digest = hash(packageBytes);
    const observedMs = Date.parse(payload.receipt.statement.observedAt);
    let latestMs = -Infinity;
    for (const profile of policy.authorities) {
      const proof = timestamps.find(item => item?.id === profile.id);
      check(fields(proof, ["id", "request", "response", "chain", "crls", "approval"]), "timestamps");
      const chain = readChain(profile, proof, keys);
      const interval = verifyTimestamp({
        packageBytes, request: proof.request, response: proof.response,
        authority: {
          kind: "independent", caPem: Buffer.from(chain.at(-1).toString()),
          signerFingerprint256: chain[0].fingerprint256, policyOid: profile.policyOid,
          maxAccuracyMs: profile.maxAccuracyMs,
        },
      });
      check(interval.digest === digest && observedMs <= interval.earliestMs && interval.latestMs < cutoffMs, "timestamp_order");
      verifyRevocation(proof.crls, profile, chain, interval, policy.reviewAt);
      latestMs = Math.max(latestMs, interval.latestMs);
    }
    const trusted = policy.mode === "historical";
    return { trusted, status: trusted ? "historical_verified" : "simulation_verified", digest,
      cutoffAt: new Date(cutoffMs).toISOString(), latestTimestampAt: new Date(latestMs).toISOString(),
      reviewedAt: policy.reviewAt, policySha256 };
  } catch (error) {
    const reason = matches(/^cal(?:07|12|13|16|30)_[a-z0-9_]+$/, error?.message) ? error.message : "cal30_invalid_evidence";
    return { trusted: false, status: "rejected", reason };
  }
}

module.exports = { verifyHistoricalPrediction };
