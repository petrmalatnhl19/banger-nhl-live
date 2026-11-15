"use strict";
// CAL-24: operator-approved, atomic receiver pin advancement. Never trust sender-supplied anchors.
const { readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync, mkdirSync, rmdirSync } = require("node:fs");
const { resolve, dirname } = require("node:path");
const { verifyTransferEvidence } = require("./core43_cal28_evidence.cjs");
const { inspectPin } = require("./core43_cal25_audit.cjs");
const HEX = /^[a-f0-9]{64}$/;
function advancePin(pinPath, transfer, publicKey, witnessId, approvedHead, hooks) {
  if (!HEX.test(approvedHead)) throw Error("cal24_operator_approval_required");
  const path = resolve(pinPath), lock = path + ".lock";
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (e) { if (e.code === "EEXIST") throw Error("cal24_locked"); throw e; }
  let temp, fd;
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
