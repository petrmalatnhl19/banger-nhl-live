"use strict";
// SECURITY-137: independent latest-checkpoint anchor fixture, offline only.
const crypto=require("node:crypto");
const {canonical:checkpointCanonical,verify:verifyCheckpoint}=require("./security136-signed-checkpoint.cjs");
const PREFIX="BANGER-CHECKPOINT-ANCHOR-V1\n";
function canonical(anchor){
 if(!anchor||typeof anchor!=="object"||Array.isArray(anchor)||Object.keys(anchor).sort().join(",")!=="checkpoint_digest,epoch,version"||anchor.version!==1||!Number.isSafeInteger(anchor.epoch)||anchor.epoch<=0||typeof anchor.checkpoint_digest!=="string"||!/^[a-f0-9]{64}$/.test(anchor.checkpoint_digest))throw Error("invalid anchor");
 return Buffer.from(PREFIX+JSON.stringify({version:1,epoch:anchor.epoch,checkpoint_digest:anchor.checkpoint_digest}),"utf8");
}
function fingerprint(checkpoint){return crypto.createHash("sha256").update(checkpointCanonical(checkpoint)).digest("hex");}
function verifyAnchor({anchor,evidence,keys,activeIds,revokedIds=[]}={}){
 try{
  if(!evidence||evidence.algorithm!=="Ed25519"||typeof evidence.key_id!=="string"||!Array.isArray(activeIds)||!activeIds.includes(evidence.key_id)||revokedIds.includes(evidence.key_id)||!Object.hasOwn(keys||{},evidence.key_id)||typeof evidence.signature!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(evidence.signature))return false;
  const key=crypto.createPublicKey(keys[evidence.key_id]),sig=Buffer.from(evidence.signature,"base64");
  return key.asymmetricKeyType==="ed25519"&&sig.length===64&&sig.toString("base64")===evidence.signature&&crypto.verify(null,canonical(anchor),key,sig);
 }catch{return false;}
}
function verifyLatest({checkpoint,checkpointEvidence,checkpointKeys,checkpointActiveIds,anchor,anchorEvidence,anchorKeys,anchorActiveIds,anchorRevokedIds=[],trustedMinimumEpoch}={}){
 if(!Number.isSafeInteger(trustedMinimumEpoch)||trustedMinimumEpoch<=0||!verifyCheckpoint({checkpoint,evidence:checkpointEvidence,keys:checkpointKeys,activeIds:checkpointActiveIds}))return false;
 if(!verifyAnchor({anchor,evidence:anchorEvidence,keys:anchorKeys,activeIds:anchorActiveIds,revokedIds:anchorRevokedIds}))return false;
 return anchor.epoch===trustedMinimumEpoch&&anchor.checkpoint_digest===fingerprint(checkpoint);
}
module.exports={canonical,fingerprint,verifyAnchor,verifyLatest};
