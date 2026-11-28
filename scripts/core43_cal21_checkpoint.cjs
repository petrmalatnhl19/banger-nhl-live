"use strict";
// CAL-21: offline checkpoint verifier. Trust anchor and minimum sequence must be supplied independently.
const { createPublicKey, verify, createHash, KeyObject } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { verifyChain, readLedger } = require("./core43_cal19_chain.cjs");
const HEX = /^[a-f0-9]{64}$/;
const canonical = ({ schema, sequence, head, witnessId }) =>
  Buffer.from(JSON.stringify([schema, sequence, head, witnessId]), "utf8");
function verifyCheckpoint(checkpoint, ledger, publicKeyPem, expectedWitnessId, minimumSequence, pinnedHead) {
  if (!checkpoint || typeof checkpoint !== "object" ||
      Object.keys(checkpoint).sort().join(",") !== "head,schema,sequence,signature,witnessId" ||
      checkpoint.schema !== "core43_cal21_checkpoint_v1" ||
      !Number.isSafeInteger(checkpoint.sequence) || checkpoint.sequence < 0 ||
      !HEX.test(checkpoint.head) ||
      typeof checkpoint.witnessId !== "string" ||
      checkpoint.witnessId !== expectedWitnessId || !/^[a-zA-Z0-9._-]{1,128}$/.test(expectedWitnessId) ||
      typeof checkpoint.signature !== "string" ||
      !/^[A-Za-z0-9+/]{86}==$/.test(checkpoint.signature) ||
      !Number.isSafeInteger(minimumSequence) || minimumSequence < 0 ||
      checkpoint.sequence < minimumSequence ||
      (pinnedHead !== undefined && (!HEX.test(pinnedHead) || checkpoint.head !== pinnedHead)))
    throw Error("cal21_checkpoint_invalid_or_rollback");
  const key = publicKeyPem instanceof KeyObject && publicKeyPem.type === "public"
    ? publicKeyPem : createPublicKey(publicKeyPem);
  if (key.asymmetricKeyType !== "ed25519") throw Error("cal21_ed25519_required");
  if (!verify(null, canonical(checkpoint), key, Buffer.from(checkpoint.signature, "base64")))
    throw Error("cal21_bad_signature");
  const state = verifyChain(ledger, checkpoint.head);
  if (state.count !== checkpoint.sequence) throw Error("cal21_sequence_mismatch");
  return { status: "verified", sequence: state.count, head: state.head, witnessId: checkpoint.witnessId,
    publicKeySha256: createHash("sha256").update(key.export({type:"spki",format:"der"})).digest("hex") };
}
if (require.main === module) {
  try {
    const [ledgerPath, checkpointPath, keyPath, witnessId, minimum, pinnedHead] = process.argv.slice(2);
    if (!ledgerPath || !checkpointPath || !keyPath || !witnessId || !/^(0|[1-9][0-9]*)$/.test(minimum || ""))
      throw Error("cal21_usage: LEDGER CHECKPOINT TRUSTED_PUBLIC_KEY WITNESS_ID MIN_SEQUENCE [PINNED_HEAD]");
    console.log(JSON.stringify(verifyCheckpoint(
      JSON.parse(readFileSync(checkpointPath, "utf8")), readLedger(ledgerPath),
      readFileSync(keyPath), witnessId, Number(minimum), pinnedHead), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { canonical, verifyCheckpoint };
