"use strict";
// CAL-28W: offline signed rotation history, anchored to a separately pinned checkpoint.
// This is NOT a live, independently hosted transparency log.
const { createHash, createPublicKey, KeyObject, verify } = require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
const FIELDS=["schema","sequence","previousHash","auditorId","oldKeyId","newKeyId",
  "newFingerprint","action","signature"];
function hashEntry(entry) {
  const payload={schema:entry.schema,sequence:entry.sequence,previousHash:entry.previousHash,
    auditorId:entry.auditorId,oldKeyId:entry.oldKeyId,newKeyId:entry.newKeyId,
    newFingerprint:entry.newFingerprint,action:entry.action};
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function verifyRotationHistory(entries, checkpoint, pinnedAuthorityKey, expectedAuditorId) {
  if (!checkpoint || typeof checkpoint!=="object" || Array.isArray(checkpoint) ||
      Object.keys(checkpoint).sort().join(",")!=="head,sequence" ||
      !Number.isSafeInteger(checkpoint.sequence) || checkpoint.sequence<0 ||
      typeof checkpoint.head!=="string" || !HEX.test(checkpoint.head))
    throw Error("cal28w_invalid_checkpoint");
  if (!Array.isArray(entries) || entries.length===0 || entries.length>64)
    throw Error("cal28w_invalid_history");
  let key;
  try {
    key=pinnedAuthorityKey instanceof KeyObject && pinnedAuthorityKey.type==="public"
      ? pinnedAuthorityKey : createPublicKey(pinnedAuthorityKey);
    if(key.asymmetricKeyType!=="ed25519") throw Error("wrong_algorithm");
  } catch(_) { throw Error("cal28w_invalid_authority_key"); }
  let head=checkpoint.head,sequence=checkpoint.sequence,active=null;
  const used=new Set();
  for(const e of entries) {
    if(!e || typeof e!=="object" || Array.isArray(e) ||
       Object.keys(e).sort().join(",")!==[...FIELDS].sort().join(","))
      throw Error("cal28w_invalid_entry_schema");
    if(e.schema!=="core43_cal28w_rotation_v1" ||
       !Number.isSafeInteger(e.sequence) || e.sequence!==sequence+1 ||
       e.previousHash!==head || e.auditorId!==expectedAuditorId ||
       typeof e.auditorId!=="string" || !/^[A-Za-z0-9._:-]{3,128}$/.test(e.auditorId))
      throw Error("cal28w_history_rollback_or_fork");
    for(const name of ["newKeyId","oldKeyId"]) {
      if(typeof e[name]!=="string" || !/^[A-Za-z0-9._:-]{3,128}$/.test(e[name]))
        throw Error("cal28w_invalid_key_id");
    }
    if(!HEX.test(e.newFingerprint) || used.has(e.newKeyId))
      throw Error("cal28w_reused_or_invalid_key");
    if(e.action!=="bootstrap" && e.action!=="rotate")
      throw Error("cal28w_invalid_action");
    if(active===null) {
      if(e.action!=="bootstrap" || e.oldKeyId!=="none")
        throw Error("cal28w_missing_bootstrap");
    } else if(e.action!=="rotate" || e.oldKeyId!==active || e.oldKeyId===e.newKeyId)
      throw Error("cal28w_unauthorized_rotation");
    if(typeof e.signature!=="string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(e.signature) ||
       Buffer.from(e.signature,"base64").toString("base64")!==e.signature)
      throw Error("cal28w_invalid_signature_encoding");
    const payload=hashEntry(e);
    if(!verify(null,Buffer.from(payload,"hex"),key,Buffer.from(e.signature,"base64")))
      throw Error("cal28w_signature_invalid");
    used.add(e.newKeyId);active=e.newKeyId;head=payload;sequence=e.sequence;
  }
  return {head,sequence,activeKeyId:active,signatureChainValid:true,trusted:false,
    status:"offline_rotation_chain_only"};
}
module.exports={hashEntry,verifyRotationHistory};
