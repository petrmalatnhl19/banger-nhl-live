"use strict";
// CAL-19 offline append-only hash-chain prototype. Pin head outside the ledger to detect rollback.
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, mkdirSync, renameSync, rmSync, rmdirSync } = require("node:fs");
const { resolve, dirname, join } = require("node:path");
const { verifyArchive } = require("./core43_cal18_archive.cjs");
const sha = value => createHash("sha256").update(value).digest("hex");
const HEX = /^[a-f0-9]{64}$/;
const GENESIS = "0".repeat(64);
function digestEntry(seq, archiveDigest, previous) {
  return sha(Buffer.from(JSON.stringify(["core43_cal19_v1", seq, archiveDigest, previous])));
}
function readLedger(path) {
  try {
    const lines = readFileSync(path, "utf8").trim();
    return lines ? lines.split("\n").map(line => JSON.parse(line)) : [];
  } catch (e) { if (e.code === "ENOENT") return []; throw e; }
}
function verifyChain(entries, pinnedHead) {
  if (!Array.isArray(entries) || (pinnedHead !== undefined && !HEX.test(pinnedHead)))
    throw Error("cal19_invalid_input");
  let previous = GENESIS;
  const seen = new Set();
  entries.forEach((entry, i) => {
    if (entry?.seq !== i + 1 || !HEX.test(entry.archiveDigest) ||
        entry.previous !== previous || seen.has(entry.archiveDigest) ||
        entry.head !== digestEntry(entry.seq, entry.archiveDigest, previous) ||
        Object.keys(entry).sort().join(",") !== "archiveDigest,head,previous,seq")
      throw Error("cal19_chain_invalid");
    seen.add(entry.archiveDigest);
    previous = entry.head;
  });
  if (pinnedHead !== undefined && previous !== pinnedHead) throw Error("cal19_rollback_or_fork");
  return { count: entries.length, head: previous };
}
function recoverLedger(ledgerPath, pinnedHead) {
  if (!HEX.test(pinnedHead)) throw Error("cal19_pin_required");
  const path = resolve(ledgerPath);
  const entries = readLedger(path);
  const state = verifyChain(entries);
  if (state.head === pinnedHead) return { status: "consistent", ...state };
  const previous = entries.length > 0 ? entries[entries.length - 1].previous : GENESIS;
  if (previous === pinnedHead) return { status: "unconfirmed_append", ...state, pinnedHead };
  throw Error("cal19_rollback_or_fork");
}
function appendArchive(ledgerPath, archiveDir, pinnedHead) {
  // Only use with one exclusive writer and a separately pinned prior head.
  if (!HEX.test(pinnedHead)) throw Error("cal19_pin_required");
  const path = resolve(ledgerPath);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const lock = path + ".lock";
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (e) { if (e.code === "EEXIST") throw Error("cal19_writer_locked"); throw e; }
  try {
    const status = recoverLedger(path, pinnedHead);
    if (status.status !== "consistent") throw Error("cal19_recovery_required");
    const entries = readLedger(path);
    const manifest = verifyArchive(archiveDir);
    const digest = manifest.packageDigest;
    if (entries.some(e => e.archiveDigest === digest)) throw Error("cal19_duplicate");
    const entry = { seq: status.count + 1, archiveDigest: digest, previous: status.head,
      head: digestEntry(status.count + 1, digest, status.head) };
    const temp = path + ".next-" + process.pid;
    let fd;
    try {
      fd = openSync(temp, "wx", 0o600);
      writeFileSync(fd, entries.concat(entry).map(e => JSON.stringify(e)).join("\\n") + "\\n");
      fsyncSync(fd);
      closeSync(fd); fd = undefined;
      renameSync(temp, path);
      // Persist directory metadata before returning the new head.
      const dirFd = openSync(dirname(path), "r");
      try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
    } finally {
      if (fd !== undefined) closeSync(fd);
      rmSync(temp, { force: true });
    }
    return { ...entry, count: entry.seq };
  } finally {
    // A crash leaves a lock requiring operator inspection; never steal stale locks.
    rmdirSync(lock);
  }
}
if (require.main === module) {
  try {
    const [cmd, ...args] = process.argv.slice(2);
    if (cmd === "verify" && args.length === 2)
      console.log(JSON.stringify(verifyChain(readLedger(args[0]), args[1]), null, 2));
    else if (cmd === "recover" && args.length === 2)
      console.log(JSON.stringify(recoverLedger(args[0], args[1]), null, 2));
    else if (cmd === "append" && args.length === 3)
      console.log(JSON.stringify(appendArchive(args[0], args[1], args[2]), null, 2));
    else throw Error("cal19_usage: verify LEDGER PINNED_HEAD | recover LEDGER PINNED_HEAD | append LEDGER ARCHIVE_DIR PINNED_HEAD");
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { GENESIS, digestEntry, readLedger, verifyChain, recoverLedger, appendArchive };
