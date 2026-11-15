"use strict";

const { createHash, createPublicKey, verify } = require("node:crypto");
const { closeSync, openSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { MAX_BYTES } = require("./core43_cal07_export.cjs");
const { checkPrivate } = require("./core43_cal08_receiver.cjs");
const { prepareCapture, verifyCapture } = require("./core43_cal12_archive.cjs");

const REGISTRY_SCHEMA = "core43_cal13_keys_v1";
const MAX_PACKAGE_BYTES = 128 * 1024;
const APP_ID = 0x43414c44;
const SHA = /^[0-9a-f]{64}$/;
const LABEL = /^[A-Za-z0-9_-]{1,80}$/;
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const ed25519 = key => key?.type === "public" && key.asymmetricKeyType === "ed25519";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = value => Buffer.from(JSON.stringify(value));

function requireValid(condition, reason) {
  if (!condition) throw Error("cal13_" + reason);
}

function exactFields(value, fields) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}

function decode(encoded, maxBytes) {
  requireValid(typeof encoded === "string" && encoded.length > 0 &&
    encoded.length <= Math.ceil(maxBytes * 4 / 3) && /^[A-Za-z0-9_-]+$/.test(encoded), "encoding");
  const bytes = Buffer.from(encoded, "base64url");
  requireValid(bytes.length <= maxBytes && bytes.toString("base64url") === encoded, "encoding");
  return bytes;
}

function readRegistry(signed, trust) {
  requireValid(ed25519(trust?.rootKey) && typeof trust.source === "string" && LABEL.test(trust.source) &&
    ["historical", "simulation"].includes(trust.origin), "root");
  requireValid(exactFields(signed, ["body", "signature"]), "registry");
  const body = signed.body;
  requireValid(exactFields(body, ["schema", "version", "origin", "source", "keys"]) &&
    body.schema === REGISTRY_SCHEMA && Number.isSafeInteger(body.version) && body.version > 0 &&
    body.origin === trust.origin && body.source === trust.source &&
    Array.isArray(body.keys) && body.keys.length <= 64, "registry");
  const bytes = jsonBytes(body);
  const signature = decode(signed.signature, 64);
  requireValid(signature.length === 64 &&
    verify(null, Buffer.concat([Buffer.from(REGISTRY_SCHEMA + "\0"), bytes]), trust.rootKey, signature),
  "registry_signature");
  const keys = new Map();
  const fingerprints = new Set([hash(trust.rootKey.export({ type: "spki", format: "der" }))]);
  for (const record of body.keys) {
    requireValid(exactFields(record, ["id", "role", "publicKey", "notBefore", "notAfter", "revoked"]) &&
      typeof record.id === "string" && LABEL.test(record.id) && !keys.has(record.id) &&
      ["export", "witness"].includes(record.role) && typeof record.revoked === "boolean" &&
      typeof record.publicKey === "string" && record.publicKey.length <= 256 &&
      instant(record.notBefore) && instant(record.notAfter) && record.notBefore < record.notAfter, "registry_key");
    const key = createPublicKey({ key: decode(record.publicKey, 64), type: "spki", format: "der" });
    const fingerprint = hash(key.export({ type: "spki", format: "der" }));
    requireValid(ed25519(key) && !fingerprints.has(fingerprint), "registry_key");
    fingerprints.add(fingerprint);
    keys.set(record.id, { ...record, key, fingerprint });
  }
  return { version: body.version, digest: hash(bytes), keys };
}

function verifyPackage(bytes, registry, trust) {
  requireValid(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_PACKAGE_BYTES, "package_size");
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  const payload = JSON.parse(text);
  requireValid(exactFields(payload, ["exportBytes", "exportSignature", "capture", "receipt"]) &&
    JSON.stringify(payload) === text, "package_shape");
  const { capture, receipt } = payload;
  const at = receipt?.statement?.observedAt;
  function select(id, role) {
    const entry = registry.keys.get(id);
    requireValid(entry && entry.role === role && !entry.revoked && instant(at) &&
      entry.notBefore <= at && at < entry.notAfter, "inactive_key");
    return entry.key;
  }
  const exportTrust = { source: trust.source, keyId: capture?.exportKeyId, publicKey: select(capture?.exportKeyId, "export") };
  const witnessId = receipt?.statement?.witnessId;
  const archiveTrust = { origin: trust.origin, exportTrust, witnessId, witnessKey: select(witnessId, "witness") };
  const evidence = verifyCapture(capture, receipt, archiveTrust);
  const reconstructed = prepareCapture({
    bytes: decode(payload.exportBytes, MAX_BYTES), signature: decode(payload.exportSignature, 64),
    exportTrust, now: capture.prediction.frozenAt, origin: trust.origin,
  });
  requireValid(hash(jsonBytes(reconstructed)) === receipt.statement.captureSha256, "capture_mismatch");
  return { payload, evidence };
}

function withDatabase(path, work, create = false) {
  const location = resolve(path);
  checkPrivate(dirname(location), true);
  if (create) closeSync(openSync(location, "wx", 0o600));
  checkPrivate(location, false);
  const db = new DatabaseSync(location);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA trusted_schema = OFF; BEGIN IMMEDIATE;");
    if (!create) {
      requireValid(db.prepare("PRAGMA application_id").get().application_id === APP_ID &&
        db.prepare("PRAGMA user_version").get().user_version === 1 &&
        db.prepare("PRAGMA quick_check(1)").get().quick_check === "ok", "coordinator_format");
    }
    const result = work(db);
    db.exec("COMMIT");
    return result;
  } finally {
    db.close();
  }
}

function initializeCoordinator(path, signed, trust) {
  const record = readRegistry(signed, trust);
  withDatabase(path, db => {
    db.exec(`
      PRAGMA application_id = ${APP_ID};
      PRAGMA user_version = 1;
      CREATE TABLE policy (
        id INTEGER PRIMARY KEY CHECK (id = 1), version INTEGER NOT NULL, digest TEXT NOT NULL, registry TEXT NOT NULL
      ) STRICT;
      CREATE TABLE policy_history (
        version INTEGER PRIMARY KEY, digest TEXT NOT NULL UNIQUE, registry TEXT NOT NULL
      ) STRICT;
      CREATE TABLE captures (
        game_id TEXT NOT NULL, kickoff_at TEXT NOT NULL, digest TEXT NOT NULL UNIQUE, package BLOB NOT NULL, registry_version INTEGER NOT NULL,
        PRIMARY KEY (game_id, kickoff_at)
      ) STRICT;
    `);
    const serialized = JSON.stringify(signed);
    db.prepare("INSERT INTO policy VALUES (1, ?, ?, ?)").run(record.version, record.digest, serialized);
    db.prepare("INSERT INTO policy_history VALUES (?, ?, ?)").run(record.version, record.digest, serialized);
  }, true);
}

function activeRegistry(db, trust) {
  const current = db.prepare("SELECT version, digest, registry FROM policy WHERE id = 1").get();
  const latest = db.prepare("SELECT version, digest FROM policy_history ORDER BY version DESC LIMIT 1").get();
  requireValid(current && latest, "missing_registry");
  requireValid(current.version === latest.version && current.digest === latest.digest, "registry_integrity");
  const registry = readRegistry(JSON.parse(current.registry), trust);
  requireValid(registry.version === current.version && registry.digest === current.digest, "registry_integrity");
  return registry;
}

function installRegistry(path, signed, trust) {
  const next = readRegistry(signed, trust);
  return withDatabase(path, db => {
    const current = activeRegistry(db, trust);
    requireValid(next.version >= current.version &&
      (next.version !== current.version || next.digest === current.digest), "registry_rollback");
    for (const [id, old] of current.keys) {
      const updated = next.keys.get(id);
      requireValid(updated && updated.role === old.role && updated.fingerprint === old.fingerprint &&
        updated.notBefore === old.notBefore && updated.notAfter <= old.notAfter &&
        (!old.revoked || updated.revoked), "registry_history");
    }
    if (next.version === current.version) return false;
    const serialized = JSON.stringify(signed);
    db.prepare("INSERT INTO policy_history VALUES (?, ?, ?)").run(next.version, next.digest, serialized);
    db.prepare("UPDATE policy SET version = ?, digest = ?, registry = ? WHERE id = 1")
      .run(next.version, next.digest, serialized);
    return true;
  });
}

function acceptPackage(path, bytes, trust) {
  return withDatabase(path, db => {
    const registry = activeRegistry(db, trust);
    const { payload } = verifyPackage(bytes, registry, trust);
    const { gameId, kickoffAt } = payload.capture.prediction;
    const digest = hash(bytes);
    const prior = db.prepare("SELECT digest FROM captures WHERE game_id = ? AND kickoff_at = ?").get(gameId, kickoffAt);
    if (prior) return { status: prior.digest === digest ? "duplicate" : "conflict", digest: prior.digest };
    db.prepare("INSERT INTO captures VALUES (?, ?, ?, ?, ?)").run(gameId, kickoffAt, digest, bytes, registry.version);
    return { status: "accepted", digest };
  });
}

function readAccepted(path, digest, trust) {
  requireValid(typeof digest === "string" && SHA.test(digest), "digest");
  return withDatabase(path, db => {
    const registry = activeRegistry(db, trust);
    const row = db.prepare("SELECT package FROM captures WHERE digest = ? AND length(package) <= ?").get(digest, MAX_PACKAGE_BYTES);
    if (!row) return null;
    const bytes = Buffer.from(row.package);
    requireValid(hash(bytes) === digest, "stored_integrity");
    return verifyPackage(bytes, registry, trust);
  });
}

module.exports = { MAX_PACKAGE_BYTES, initializeCoordinator, installRegistry, acceptPackage, readAccepted };
