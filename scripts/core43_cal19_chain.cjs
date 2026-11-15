"use strict";
// CAL-19 offline append-only hash-chain prototype. Pin head outside the ledger to detect rollback.
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync, openSync, closeSync, fsyncSync, mkdirSync, renameSync, rmSync } = require("node:fs");
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
function appendArchive(ledgerPath, archiveDir, pinnedHead) {
  // Only use with one exclusive writer and a separately pinned prior head.
  if (!HEX.test(pinnedHead)) throw Error("cal19_pin_required");
  const path = resolve(ledgerPath);
  const entries = readLedger(path);
  const state = verifyChain(entries, pinnedHead);
  const manifest = verifyArchive(archiveDir);
  const digest = manifest.packageDigest;
  if (entries.some(e => e.archiveDigest === digest)) throw Error("cal19_duplicate");
  const entry = { seq: state.count + 1, archiveDigest: digest, previous: state.head,
    head: digestEntry(state.count + 1, digest, state.head) };
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = path + ".next-" + process.pid;
  let fd;
  try {
    fd = openSync(temp, "wx", 0o600);
    writeFileSync(fd, entries.concat(entry).map(e => JSON.stringify(e)).join("\n") + "\n");
    fsyncSync(fd);
    closeSync(fd); fd = undefined;
    // A single-writer lock is required; atomic rename prevents torn ledger content.
    renameSync(temp, path);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temp, { force: true });
  }
  return { ...entry, count: entry.seq };
}
if (require.main === module) {
  try {
    const [cmd, ...args] = process.argv.slice(2);
    if (cmd === "verify" && args.length === 2)
      console.log(JSON.stringify(verifyChain(readLedger(args[0]), args[1]), null, 2));
    else if (cmd === "append" && args.length === 3)
      console.log(JSON.stringify(appendArchive(args[0], args[1], args[2]), null, 2));
    else throw Error("cal19_usage: verify LEDGER PINNED_HEAD | append LEDGER ARCHIVE_DIR PINNED_HEAD");
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { GENESIS, digestEntry, readLedger, verifyChain, appendArchive };
