"use strict";

const { createPublicKey } = require("node:crypto");
const { closeSync, constants, fstatSync, lstatSync, openSync, readSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { MAX_BYTES, planSignedExport } = require("./core43_cal07_export.cjs");

const APPLICATION_ID = 0x43414c38;
const LEDGER_VERSION = 1;

function readBoundedFile(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size === 0 || stat.size > limit) throw Error("cal08_input_file");
    const bytes = Buffer.alloc(limit + 1);
    let position = 0;
    while (position < bytes.length) {
      const count = readSync(fd, bytes, position, bytes.length - position, null);
      if (!count) break;
      position += count;
    }
    if (position !== stat.size || position > limit) throw Error("cal08_input_file");
    return bytes.subarray(0, position);
  } finally {
    closeSync(fd);
  }
}

function checkPrivate(path, directory) {
  const stat = lstatSync(path);
  if (!(directory ? stat.isDirectory() : stat.isFile()) ||
      (stat.mode & 0o077) !== 0 || stat.uid !== process.getuid() || (!directory && stat.nlink !== 1)) {
    throw Error("cal08_ledger_permissions");
  }
}

function openLedger(path) {
  const db = new DatabaseSync(path);
  try {
    db.exec("PRAGMA busy_timeout = 5000; PRAGMA synchronous = FULL; PRAGMA trusted_schema = OFF;");
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

function initializeLedger(ledgerPath, source) {
  if (typeof source !== "string" || !source.trim()) throw Error("cal08_ledger_source");
  const path = resolve(ledgerPath);
  checkPrivate(dirname(path), true);
  closeSync(openSync(path, "wx", 0o600));
  const db = openLedger(path);
  try {
    db.exec(`
      PRAGMA journal_mode = DELETE;
      BEGIN IMMEDIATE;
      PRAGMA application_id = ${APPLICATION_ID};
      PRAGMA user_version = ${LEDGER_VERSION};
      CREATE TABLE ledger (id INTEGER PRIMARY KEY CHECK (id = 1), source TEXT NOT NULL) STRICT;
      CREATE TABLE receipts (
        game_id TEXT NOT NULL,
        kickoff_at TEXT NOT NULL,
        receipt TEXT NOT NULL CHECK (json_valid(receipt)),
        PRIMARY KEY (game_id, kickoff_at)
      ) STRICT;
    `);
    db.prepare("INSERT INTO ledger (id, source) VALUES (1, ?)").run(source);
    db.exec("COMMIT");
  } finally {
    db.close();
  }
}

function receiveExport({
  ledgerPath, payloadPath, signaturePath, trust, clock = () => new Date().toISOString(),
}) {
  const bytes = readBoundedFile(payloadPath, MAX_BYTES);
  const signature = readBoundedFile(signaturePath, 64);
  const path = resolve(ledgerPath);
  checkPrivate(dirname(path), true);
  checkPrivate(path, false);

  const db = openLedger(path);
  try {
    db.exec("BEGIN IMMEDIATE");
    if (db.prepare("PRAGMA application_id").get().application_id !== APPLICATION_ID ||
        db.prepare("PRAGMA user_version").get().user_version !== LEDGER_VERSION ||
        db.prepare("PRAGMA quick_check(1)").get().quick_check !== "ok") {
      throw Error("cal08_ledger_invalid");
    }
    if (!trust || db.prepare("SELECT source FROM ledger WHERE id = 1").get()?.source !== trust.source) {
      throw Error("cal08_ledger_source");
    }

    const now = clock();
    const { exportSha256, result } = planSignedExport({ bytes, signature, trust, now, existing: [] });
    if (!result.ready) {
      db.exec("COMMIT");
      return { status: "skipped", reason: result.reason };
    }

    // CAL-03 produces all four variants for a canonical game, kickoff and the
    // fixed 60-minute window. Persist that group as one indivisible receipt.
    const { gameId, kickoffAt } = result.variants[0].record;
    const accepted = {
      gameId, kickoffAt, exportSha256, acceptedAt: now,
      variants: result.variants.map(({ key, sha256, record }) => ({
        key, sha256, coefficient: record.coefficient, away: record.away, home: record.home,
      })),
    };
    const prior = db.prepare("SELECT receipt FROM receipts WHERE game_id = ? AND kickoff_at = ?").get(gameId, kickoffAt);
    if (!prior) {
      db.prepare("INSERT INTO receipts (game_id, kickoff_at, receipt) VALUES (?, ?, ?)")
        .run(gameId, kickoffAt, JSON.stringify(accepted));
    }
    const receipt = prior ? JSON.parse(prior.receipt) : accepted;
    db.exec("COMMIT");
    return { status: prior ? "duplicate" : "accepted", receipt };
  } finally {
    // Closing an uncommitted connection rolls the whole transaction back.
    db.close();
  }
}

if (require.main === module) {
  try {
    const [command, ledgerPath, ...args] = process.argv.slice(2);
    if (command === "init" && ledgerPath && args.length === 1) {
      initializeLedger(ledgerPath, args[0]);
      console.log(JSON.stringify({ status: "initialized" }));
    } else if (command === "receive" && ledgerPath && args.length === 5) {
      const [payloadPath, signaturePath, keyPath, source, keyId] = args;
      const publicKey = createPublicKey(readBoundedFile(keyPath, 4096));
      const result = receiveExport({ ledgerPath, payloadPath, signaturePath, trust: { source, keyId, publicKey } });
      console.log(JSON.stringify({ status: result.status, gameId: result.receipt?.gameId, reason: result.reason }));
    } else {
      throw Error("cal08_usage");
    }
  } catch (error) {
    const known = /^cal0[78]_[a-z_]+$/.test(error.message) ? error.message : "cal08_receive_failed";
    console.error(known);
    process.exitCode = 1;
  }
}

module.exports = { initializeLedger, receiveExport };
