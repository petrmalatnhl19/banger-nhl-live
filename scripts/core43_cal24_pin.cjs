"use strict";
// CAL-24: operator-approved, atomic receiver pin advancement. Never trust sender-supplied anchors.
const { readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync, mkdirSync, rmdirSync } = require("node:fs");
const { resolve, dirname, join } = require("node:path");
const { mkdtempSync, cpSync, lstatSync, readdirSync, chmodSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { verifyTransferEvidence } = require("./core43_cal28_evidence.cjs");
const { inspectPin } = require("./core43_cal25_audit.cjs");
const HEX = /^[a-f0-9]{64}$/;
// CAL-28P: refuse link-based or non-regular inputs before copying to private storage.
function inspectCopyTree(path, depth = 0) {
  if (depth > 4) throw Error("cal28p_archive_depth_exceeded");
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw Error("cal28p_link_rejected");
  if (stat.isFile()) {
    if (stat.nlink !== 1) throw Error("cal28p_hardlink_rejected");
    return;
  }
  if (!stat.isDirectory()) throw Error("cal28p_nonregular_rejected");
  for (const name of readdirSync(path)) inspectCopyTree(join(path, name), depth + 1);
}

function advancePin(pinPath, transfer, publicKey, witnessId, approvedHead, hooks) {
  if (!HEX.test(approvedHead)) throw Error("cal24_operator_approval_required");
  const path = resolve(pinPath), lock = path + ".lock";
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (e) { if (e.code === "EEXIST") throw Error("cal24_locked"); throw e; }
  let temp, fd, snapshot;
  try {
    // The writer owns the lock just acquired above; all other audit findings are fatal.
    const audit = inspectPin(path);
    const blockers = audit.findings.filter(code => code !== "manual_lock_review_required");
    if (blockers.length || !audit.pin) throw Error("cal28_receiver_preflight_failed:" + blockers.join(","));
    const anchor = audit.pin;
    if (Object.keys(anchor).sort().join(",") !== "head,sequence" ||
        !Number.isSafeInteger(anchor.sequence) || anchor.sequence < 0 || !HEX.test(anchor.head))
      throw Error("cal24_invalid_anchor");
    // CAL-28I: no signature-only fallback. Evidence is mandatory under the writer lock.
    if (typeof hooks?.archiveRoot !== "string" || !hooks.archiveRoot)
      throw Error("cal28i_archive_root_required");
    const verified = verifyTransferEvidence(transfer, publicKey, witnessId, anchor, hooks.archiveRoot);
    if (verified.next.head !== approvedHead) throw Error("cal24_approval_mismatch");
    if (verified.next.sequence === anchor.sequence) return { status: "unchanged", ...verified.next };
    const next = { sequence: verified.next.sequence, head: verified.next.head };
    temp = path + ".next-" + process.pid;
    fd = openSync(temp, "wx", 0o600);
    writeFileSync(fd, JSON.stringify(next) + "\n");
    fsyncSync(fd); closeSync(fd); fd = undefined;
    hooks?.onStage?.("temp_fsynced");
    // CAL-28O: independently verify a private copy before the final commit check.
    // This is a verified private copy, NOT an OS-enforced immutable snapshot.
    snapshot = mkdtempSync(join(tmpdir(), "cal28o-snapshot-"));
    const snapshotRoot = join(snapshot, "evidence");
    chmodSync(snapshot, 0o700);
    mkdirSync(snapshotRoot, { mode: 0o700 });
    for (const entry of transfer.ledger) {
      if (!HEX.test(entry.archiveDigest)) throw Error("cal28o_invalid_digest");
      const source = join(resolve(hooks.archiveRoot), entry.archiveDigest);
      const stat = lstatSync(source);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw Error("cal28o_unsafe_source_directory");
      inspectCopyTree(source);
      cpSync(source, join(snapshotRoot, entry.archiveDigest), { recursive: true, dereference: false, errorOnExist: true, force: false });
      inspectCopyTree(join(snapshotRoot, entry.archiveDigest));
    }
    hooks?.onStage?.("snapshot_copied", snapshotRoot);
    const snapVerified = verifyTransferEvidence(transfer, publicKey, witnessId, anchor, snapshotRoot);
    if (snapVerified.next.head !== next.head || snapVerified.next.sequence !== next.sequence)
      throw Error("cal28o_snapshot_mismatch");
    // CAL-28L: catch archive mutations occurring after initial verification
    // and before the durable pin rename. This is not an atomic archive snapshot.
    const precommit = verifyTransferEvidence(transfer, publicKey, witnessId, anchor, hooks.archiveRoot);
    if (JSON.stringify(precommit.archiveDirectoryIdentities) !== JSON.stringify(verified.archiveDirectoryIdentities))
      throw Error("cal28m_archive_directory_identity_changed");
    if (precommit.next.head !== next.head || precommit.next.sequence !== next.sequence)
      throw Error("cal28l_precommit_transfer_changed");
    renameSync(temp, path); temp = undefined;
    hooks?.onStage?.("pin_renamed");
    const dir = openSync(dirname(path), "r");
    try { fsyncSync(dir); } finally { closeSync(dir); }
    hooks?.onStage?.("directory_fsynced");
    return { status: "advanced", ...next };
  } finally {
    if (snapshot) rmSync(snapshot, { recursive: true, force: true });
    if (fd !== undefined) closeSync(fd);
    if (temp) rmSync(temp, { force: true });
    rmdirSync(lock);
  }
}
module.exports = { advancePin };
if (require.main === module) {
  try {
    const [pin, transferFile, keyFile, witness, approved] = process.argv.slice(2);
    if (!pin || !transferFile || !keyFile || !witness || !approved || process.argv.length !== 7)
      throw Error("cal24_usage: RECEIVER_PIN TRANSFER_JSON TRUSTED_PUBLIC_PEM WITNESS_ID OPERATOR_APPROVED_HEAD");
    // CAL-28D: prevent the legacy CLI from bypassing evidence verification.
    // Use CAL-28C entrypoint with an independently supplied archive root instead.
    throw Error("cal28d_legacy_cli_disabled_use_cal28_approved");
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
