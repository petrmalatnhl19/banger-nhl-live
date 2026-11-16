"use strict";

const { execFileSync } = require("node:child_process");
const { createHash, createPublicKey } = require("node:crypto");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { MAX_PACKAGE_BYTES, readRegistry, verifyPackage } = require("./core43_cal13_coordinator.cjs");

const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[a-z0-9][a-z0-9-]{2,63}$/;
const OID = /^\d+(?:\.\d+){2,}$/;
const MAX_CONFIG_BYTES = 64 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = bytes => bytes.toString("base64url");
const matches = (pattern, value) => typeof value === "string" && pattern.test(value);

function requireValid(condition, reason) {
  if (!condition) throw Error("cal32_" + reason);
}

function fields(value, names) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function readPinnedDocument(bytes, pin, reason) {
  requireValid(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_CONFIG_BYTES &&
    matches(SHA256, pin) && hash(bytes) === pin, reason + "_pin");
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const value = JSON.parse(text);
    requireValid(JSON.stringify(value) === text, reason + "_format");
    return value;
  } catch {
    throw Error("cal32_" + reason + "_format");
  }
}

function validatePlan(plan) {
  requireValid(fields(plan, ["schema", "mode", "gameId", "kickoffAt", "packageRegistry", "authorities"]) &&
    plan.schema === "core43_cal32_pregame_plan_v1" && ["simulation", "historical"].includes(plan.mode) &&
    matches(/^\d{10}$/, plan.gameId) && typeof plan.kickoffAt === "string" &&
    fields(plan.packageRegistry, ["source", "rootKey", "registrySha256"]) &&
    matches(/^[A-Za-z0-9_-]{59}$/, plan.packageRegistry.rootKey) &&
    Array.isArray(plan.authorities) && plan.authorities.length === 2, "plan_format");
  const { authorities } = plan;
  requireValid(authorities.every(authority => fields(authority, ["id", "operatorId", "policyOid"]) &&
    matches(ID, authority.id) && matches(ID, authority.operatorId) && matches(OID, authority.policyOid) &&
    authority.policyOid.length <= 100) && authorities[0].id !== authorities[1].id &&
    authorities[0].operatorId !== authorities[1].operatorId, "authorities");
}

function generateRequests(digest, authorities) {
  const directory = mkdtempSync(join(tmpdir(), "cal32-tsq-"));
  const run = args => execFileSync("openssl", ["ts", "-query", ...args], {
    env: { PATH: process.env.PATH, LC_ALL: "C" }, timeout: 5000, maxBuffer: 16 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const nonces = new Set();
    return authorities.map(({ id, policyOid }, index) => {
      const request = run(["-digest", digest, "-sha256", "-cert", "-tspolicy", policyOid]);
      requireValid(request.length > 0 && request.length <= 4096, "request");
      const path = join(directory, "request-" + index + ".tsq");
      writeFileSync(path, request, { mode: 0o600, flag: "wx" });
      const details = run(["-in", path, "-text"]).toString("utf8");
      const hexNonce = /^Nonce: 0x([0-9a-f]+)$/im.exec(details)?.[1];
      const nonce = hexNonce ? BigInt("0x" + hexNonce) : 0n;
      requireValid(nonce !== 0n && !nonces.has(nonce), "nonce");
      nonces.add(nonce);
      return { id, policyOid, requestSha256: hash(request), request: encode(request) };
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function preparePregameRequests({ packageBytes, registryBytes, planBytes, expectedPlanSha256 }, clock = Date.now) {
  // The expected plan digest comes from independently held operator configuration.
  const plan = readPinnedDocument(planBytes, expectedPlanSha256, "plan");
  validatePlan(plan);
  const rootDer = Buffer.from(plan.packageRegistry.rootKey, "base64url");
  requireValid(encode(rootDer) === plan.packageRegistry.rootKey, "registry_root");
  const rootKey = createPublicKey({ key: rootDer, type: "spki", format: "der" });
  requireValid(rootDer.equals(rootKey.export({ type: "spki", format: "der" })), "registry_root");
  const trust = { rootKey, source: plan.packageRegistry.source, origin: plan.mode };
  const registry = readRegistry(readPinnedDocument(registryBytes, plan.packageRegistry.registrySha256, "registry"), trust);
  const { payload } = verifyPackage(packageBytes, registry, trust);
  const { gameId, kickoffAt } = payload.capture.prediction;
  requireValid(gameId === plan.gameId && kickoffAt === plan.kickoffAt, "game_binding");
  const observedMs = Date.parse(payload.receipt.statement.observedAt);
  const kickoffMs = Date.parse(kickoffAt);
  const startedMs = clock();
  requireValid(Number.isSafeInteger(startedMs) && observedMs <= startedMs && startedMs < kickoffMs, "pregame_window");
  const digest = hash(packageBytes);
  const requests = generateRequests(digest, plan.authorities);
  const finishedMs = clock();
  requireValid(Number.isSafeInteger(finishedMs) && startedMs <= finishedMs && finishedMs < kickoffMs, "pregame_window");
  return {
    schema: "core43_cal32_pregame_requests_v1", status: "requests_prepared", trusted: false,
    mode: plan.mode, gameId, kickoffAt, preparedAt: new Date(finishedMs).toISOString(),
    packageSha256: digest, planSha256: expectedPlanSha256,
    packageBytes: encode(packageBytes), registryBytes: encode(registryBytes),
    requests,
  };
}

if (require.main === module) {
  try {
    requireValid(process.argv.length === 6, "usage");
    const [packagePath, registryPath, planPath, expectedPlanSha256] = process.argv.slice(2);
    const result = preparePregameRequests({
      packageBytes: readBoundedFile(packagePath, MAX_PACKAGE_BYTES),
      registryBytes: readBoundedFile(registryPath, MAX_CONFIG_BYTES),
      planBytes: readBoundedFile(planPath, MAX_CONFIG_BYTES),
      expectedPlanSha256,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
  } catch (error) {
    const reason = matches(/^cal(?:08|12|13|32)_[a-z0-9_]+$/, error?.message) ? error.message : "cal32_preparation_failed";
    process.stdout.write(JSON.stringify({ trusted: false, status: "rejected", reason }) + "\n");
    process.exitCode = 1;
  }
}

module.exports = { preparePregameRequests };
