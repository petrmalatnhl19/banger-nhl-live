"use strict";
// CAL-22: portable offline checkpoint transfer; the receiver owns its trust anchor.
const { verifyCheckpoint } = require("./core43_cal21_checkpoint.cjs");
const { verifyChain, GENESIS } = require("./core43_cal19_chain.cjs");
const HEX = /^[a-f0-9]{64}$/;
function verifyTransfer(transfer, trustedPublicKey, witnessId, trustedAnchor) {
  if (!transfer || typeof transfer !== "object" || Array.isArray(transfer) ||
      Object.keys(transfer).sort().join(",") !== "checkpoint,ledger,schema" ||
      transfer.schema !== "core43_cal22_transfer_v1" || !Array.isArray(transfer.ledger) ||
      !trustedAnchor || !Number.isSafeInteger(trustedAnchor.sequence) ||
      trustedAnchor.sequence < 0 || !HEX.test(trustedAnchor.head))
    throw Error("cal22_invalid_transfer_or_anchor");
  const anchor = trustedAnchor;
  if (transfer.ledger.length < anchor.sequence) throw Error("cal22_rollback");
  const prefix = verifyChain(transfer.ledger.slice(0, anchor.sequence), anchor.head);
  if (prefix.count !== anchor.sequence) throw Error("cal22_anchor_mismatch");
  const result = verifyCheckpoint(transfer.checkpoint, transfer.ledger,
    trustedPublicKey, witnessId, anchor.sequence);
  if (result.sequence === anchor.sequence && result.head !== anchor.head)
    throw Error("cal22_fork");
  return { status: "verified", previous: { sequence: anchor.sequence, head: anchor.head },
    next: { sequence: result.sequence, head: result.head }, witnessId: result.witnessId,
    publicKeySha256: result.publicKeySha256 };
}
module.exports = { verifyTransfer };
if (require.main === module) {
  const { readFileSync } = require("node:fs");
  try {
    const [transferFile, keyFile, witnessId, anchorFile] = process.argv.slice(2);
    if (!transferFile || !keyFile || !witnessId || !anchorFile || process.argv.length !== 6)
      throw Error("cal22_usage: TRANSFER_JSON TRUSTED_PUBLIC_PEM WITNESS_ID TRUSTED_ANCHOR_JSON");
    const transfer = JSON.parse(readFileSync(transferFile, "utf8"));
    const anchor = JSON.parse(readFileSync(anchorFile, "utf8"));
    console.log(JSON.stringify(verifyTransfer(transfer, readFileSync(keyFile), witnessId, anchor), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
