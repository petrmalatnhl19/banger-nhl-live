"use strict";

const { createHash, sign, verify } = require("node:crypto");
const { closeSync, linkSync, mkdtempSync, openSync, rmSync, writeFileSync } = require("node:fs");
const { dirname, join, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { COEFFICIENTS } = require("./core43_cal03_capture_plan.cjs");
const { LEDGER_VERSION, checkPrivate, initializeLedger, readBoundedFile, receiveExport, validateLedger, validateLedgerSchema } =
  require("./core43_cal08_receiver.cjs");

const FORMAT = "core43_cal09_ledger_v1";
const DOMAIN = Buffer.from(FORMAT + "\0");
const MAX_SQLITE_BYTES = 16 * 1024 * 1024;
const AUTHORITY_ID = 0x43414c39;
const SHA = /^[a-f0-9]{64}$/;
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const timestamp = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

function requireValid(ok, code) {
  if (!ok) throw Error("cal09_" + code);
}

function withWorkspace(directory, work) {
  checkPrivate(directory, true);
  const temp = mkdtempSync(join(directory, "cal09-"));
  try {
    return work(temp);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function validateReceipts(path, source) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    db.exec("PRAGMA trusted_schema = OFF;");
    validateLedger(db, source);
    validateLedgerSchema(db);
    for (const row of db.prepare("SELECT game_id, kickoff_at, receipt FROM receipts").iterate()) {
      const receipt = JSON.parse(row.receipt);
      requireValid(receipt && Object.keys(receipt).length === 5 && receipt.gameId === row.game_id && typeof row.game_id === "string" &&
        /^[1-9][0-9]{0,15}$/.test(row.game_id) && receipt.kickoffAt === row.kickoff_at &&
        timestamp(row.kickoff_at) && timestamp(receipt.acceptedAt) &&
        typeof receipt.exportSha256 === "string" && SHA.test(receipt.exportSha256) &&
        Array.isArray(receipt.variants) && receipt.variants.length === COEFFICIENTS.length &&
        COEFFICIENTS.every((coefficient, index) => {
          const variant = receipt.variants[index];
          const key = [row.game_id, "core43_cal03_dryrun_v1", row.kickoff_at, "60m", coefficient].join(":");
          return variant && Object.keys(variant).length === 5 && variant.key === key && variant.coefficient === coefficient &&
            typeof variant.sha256 === "string" && SHA.test(variant.sha256) &&
            [variant.away, variant.home].every(score => Number.isFinite(score) && score >= 0);
        }), "receipt");
    }
  } finally {
    db.close();
  }
}

function makeSnapshot(path, directory, trust, privateKey, prior) {
  requireValid(privateKey?.type === "private" && privateKey.asymmetricKeyType === "ed25519", "signing_key");
  const copy = join(directory, "candidate.sqlite");
  const db = new DatabaseSync(path);
  try {
    db.prepare("VACUUM INTO ?").run(copy);
  } finally {
    db.close();
  }
  const sqlite = readBoundedFile(copy, MAX_SQLITE_BYTES);
  validateReceipts(copy, trust.source);
  const manifest = Buffer.from(JSON.stringify({
    format: FORMAT, ledgerId: trust.ledgerId, source: trust.source, version: LEDGER_VERSION,
    generation: prior ? prior.generation + 1 : 0,
    previousDigest: prior?.digest ?? null,
    sqliteSha256: digest(sqlite),
  }));
  const signature = sign(null, Buffer.concat([DOMAIN, manifest]), privateKey);
  return { manifest, signature, sqlite };
}

function verifySnapshot(bundle, head, trust) {
  requireValid(trust?.publicKey?.type === "public" && trust.publicKey.asymmetricKeyType === "ed25519" &&
    [trust.ledgerId, trust.source].every(value => typeof value === "string" && value.length > 0 && value.length <= 128),
  "trust");
  const { manifest, signature, sqlite } = bundle ?? {};
  requireValid(Buffer.isBuffer(manifest) && manifest.length > 0 && manifest.length <= 4096 &&
    Buffer.isBuffer(signature) && signature.length === 64 &&
    Buffer.isBuffer(sqlite) && sqlite.length > 0 && sqlite.length <= MAX_SQLITE_BYTES, "size");
  requireValid(verify(null, Buffer.concat([DOMAIN, manifest]), trust.publicKey, signature), "signature");
  const json = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(manifest);
  const data = JSON.parse(json);
  requireValid(data && JSON.stringify(data) === json && Object.keys(data).length === 7 &&
    data.format === FORMAT && data.version === LEDGER_VERSION &&
    data.ledgerId === trust.ledgerId && data.source === trust.source &&
    Number.isSafeInteger(data.generation) && data.generation >= 0 &&
    (data.generation === 0 ? data.previousDigest === null :
      typeof data.previousDigest === "string" && SHA.test(data.previousDigest)),
  "manifest");
  // The expected head comes from the trusted authority, never from the files being restored.
  requireValid(data.generation === head?.generation && digest(manifest) === head?.digest, "head_mismatch");
  requireValid(digest(sqlite) === data.sqliteSha256, "integrity");
}

function restoreSnapshot({ bundle, head, trust, target }) {
  verifySnapshot(bundle, head, trust);
  const path = resolve(target);
  withWorkspace(dirname(path), temp => {
    const candidate = join(temp, "restored.sqlite");
    writeFileSync(candidate, bundle.sqlite, { flag: "wx", mode: 0o600 });
    validateReceipts(candidate, trust.source);
    // Publish the validated file atomically and never replace a working ledger.
    linkSync(candidate, path);
  });
}

function withAuthority(path, work, { create = false, readOnly = false } = {}) {
  const location = resolve(path);
  checkPrivate(dirname(location), true);
  if (create) closeSync(openSync(location, "wx", 0o600));
  checkPrivate(location, false);
  const db = new DatabaseSync(location, { readOnly });
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA trusted_schema = OFF;");
    if (!create) {
      requireValid(db.prepare("PRAGMA application_id").get().application_id === AUTHORITY_ID &&
        db.prepare("PRAGMA user_version").get().user_version === 1, "authority_version");
    }
    return work(db);
  } finally {
    db.close();
  }
}

function initializeAuthority({ authorityPath, workspace, trust, privateKey }) {
  const bundle = withWorkspace(workspace, temp => {
    const ledger = join(temp, "genesis.sqlite");
    initializeLedger(ledger, trust.source);
    return makeSnapshot(ledger, temp, trust, privateKey, null);
  });
  const head = { generation: 0, digest: digest(bundle.manifest) };
  verifySnapshot(bundle, head, trust);
  withAuthority(authorityPath, db => {
    db.exec(`
      BEGIN IMMEDIATE;
      PRAGMA application_id = ${AUTHORITY_ID};
      PRAGMA user_version = 1;
      CREATE TABLE head (
        singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
        generation INTEGER NOT NULL,
        digest TEXT NOT NULL,
        manifest BLOB NOT NULL,
        signature BLOB NOT NULL,
        snapshot BLOB NOT NULL
      ) STRICT;
    `);
    db.prepare("INSERT INTO head VALUES (1, ?, ?, ?, ?, ?)")
      .run(head.generation, head.digest, bundle.manifest, bundle.signature, bundle.sqlite);
    db.exec("COMMIT");
  }, { create: true });
}

function readAuthority(authorityPath) {
  return withAuthority(authorityPath, db => {
    const row = db.prepare(`
      SELECT generation, digest, manifest, signature, snapshot FROM head WHERE singleton = 1
      AND length(manifest) <= 4096 AND length(signature) = 64 AND length(snapshot) <= ?
    `).get(MAX_SQLITE_BYTES);
    requireValid(row, "authority_head");
    return {
      head: { generation: row.generation, digest: row.digest },
      bundle: { manifest: Buffer.from(row.manifest), signature: Buffer.from(row.signature), sqlite: Buffer.from(row.snapshot) },
    };
  }, { readOnly: true });
}

function receiveAcrossRuns({ authorityPath, workspace, trust, privateKey, payloadPath, signaturePath, exportTrust, clock }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { head, bundle } = readAuthority(authorityPath);
    const result = withWorkspace(workspace, temp => {
      const ledgerPath = join(temp, "working.sqlite");
      restoreSnapshot({ bundle, head, trust, target: ledgerPath });
      const outcome = receiveExport({ ledgerPath, payloadPath, signaturePath, trust: exportTrust, clock });
      if (outcome.status !== "accepted") return outcome;
      const next = makeSnapshot(ledgerPath, temp, trust, privateKey, head);
      const nextHead = { generation: head.generation + 1, digest: digest(next.manifest) };
      verifySnapshot(next, nextHead, trust);
      const committed = withAuthority(authorityPath, db => db.prepare(`
        UPDATE head SET generation = ?, digest = ?, manifest = ?, signature = ?, snapshot = ?
        WHERE singleton = 1 AND generation = ? AND digest = ?
      `).run(nextHead.generation, nextHead.digest, next.manifest, next.signature, next.sqlite,
        head.generation, head.digest).changes === 1);
      // Suppress the local acceptance if another worker advanced the head.
      return committed ? outcome : null;
    });
    if (result) return result;
  }
  throw Error("cal09_concurrent_update");
}

module.exports = { initializeAuthority, readAuthority, receiveAcrossRuns, restoreSnapshot };
