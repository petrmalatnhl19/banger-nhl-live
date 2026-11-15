"use strict";
// CAL-28C: evidence-gated receiver advancement; does not replace CAL-24 legacy interface yet.
const { readFileSync } = require("node:fs");
const { verifyTransferEvidence } = require("./core43_cal28_evidence.cjs");
const { inspectPin } = require("./core43_cal25_audit.cjs");
const { advancePin } = require("./core43_cal24_pin.cjs");
const HEX = /^[a-f0-9]{64}$/;
function advancePinWithEvidence(pinPath, transfer, trustedKey, witnessId, approvedHead, archiveRoot) {
  if (!HEX.test(approvedHead)) throw Error("cal28c_operator_approval_required");
  if (typeof archiveRoot !== "string" || !archiveRoot) throw Error("cal28c_archive_root_required");
  const audit = inspectPin(pinPath);
  if (audit.status !== "consistent") throw Error("cal28c_receiver_preflight_failed");
  const checked = verifyTransferEvidence(transfer, trustedKey, witnessId, audit.pin, archiveRoot);
  if (checked.next.head !== approvedHead) throw Error("cal28c_approval_mismatch");
  // CAL-28E: CAL-24 re-verifies evidence, pinned history and approval while holding its writer lock.
  // Evidence directories must still be immutable/trusted throughout verification and commit.
  const result = advancePin(pinPath, transfer, trustedKey, witnessId, approvedHead, { archiveRoot });
  return { ...result, evidenceStatus: checked.evidenceStatus, archivesVerified: checked.archivesVerified };
}
module.exports = { advancePinWithEvidence };
if (require.main === module) {
  try {
    const [pin, transferFile, keyFile, witness, approved, root] = process.argv.slice(2);
    if (!pin || !transferFile || !keyFile || !witness || !approved || !root || process.argv.length !== 8)
      throw Error("cal28c_usage: RECEIVER_PIN TRANSFER_JSON TRUSTED_PUBLIC_PEM WITNESS_ID APPROVED_HEAD ARCHIVE_ROOT");
    console.log(JSON.stringify(advancePinWithEvidence(pin, JSON.parse(readFileSync(transferFile, "utf8")),
      readFileSync(keyFile), witness, approved, root), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
