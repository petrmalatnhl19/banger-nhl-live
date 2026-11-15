"use strict";
// CAL-28X: offline checkpoint witnesses, NOT proof of independently hosted witnesses.
const {createPublicKey,KeyObject,verify}=require("node:crypto");
const {verifyRotationHistory}=require("./core43_cal28w_rotation_history.cjs");
const HEX=/^[a-f0-9]{64}$/;
const ID=/^[A-Za-z0-9._:-]{3,128}$/;
const FIELDS=["schema","witnessId","auditorId","sequence","head","signature"];
function verifyWitnessedRotationCheckpoint(entries,anchor,authorityKey,auditorId,
  witnesses,pinnedWitnessKeys,minimumWitnesses=2) {
  const chain=verifyRotationHistory(entries,anchor,authorityKey,auditorId);
  if(!Array.isArray(witnesses)||witnesses.length<2||witnesses.length>16||
     !Number.isSafeInteger(minimumWitnesses)||minimumWitnesses<2||
     minimumWitnesses>16||witnesses.length<minimumWitnesses||
     !pinnedWitnessKeys||typeof pinnedWitnessKeys!=="object"||
     Array.isArray(pinnedWitnessKeys))
    throw Error("cal28x_invalid_witness_configuration");
  const seen=new Set();
  for(const w of witnesses){
    if(!w||typeof w!=="object"||Array.isArray(w)||
       Object.keys(w).sort().join(",")!==[...FIELDS].sort().join(","))
      throw Error("cal28x_invalid_witness_schema");
    if(w.schema!=="core43_cal28x_witness_v1"||typeof w.witnessId!=="string"||
       !ID.test(w.witnessId)||w.witnessId===auditorId||seen.has(w.witnessId))
      throw Error("cal28x_duplicate_or_invalid_witness");
    if(w.auditorId!==auditorId||w.sequence!==chain.sequence||
       w.head!==chain.head||typeof w.head!=="string"||!HEX.test(w.head))
      throw Error("cal28x_checkpoint_mismatch");
    if(!Object.hasOwn(pinnedWitnessKeys,w.witnessId))
      throw Error("cal28x_unknown_witness");
    if(typeof w.signature!=="string"||!/^[A-Za-z0-9+/]+={0,2}$/.test(w.signature)||
       Buffer.from(w.signature,"base64").toString("base64")!==w.signature)
      throw Error("cal28x_invalid_signature_encoding");
    let key;
    try {
      const supplied=pinnedWitnessKeys[w.witnessId];
      key=supplied instanceof KeyObject&&supplied.type==="public"?supplied:createPublicKey(supplied);
      if(key.asymmetricKeyType!=="ed25519")throw Error("wrong_algorithm");
    }catch(_){throw Error("cal28x_invalid_witness_key");}
    const payload=JSON.stringify({schema:w.schema,witnessId:w.witnessId,
      auditorId:w.auditorId,sequence:w.sequence,head:w.head});
    if(!verify(null,Buffer.from(payload),key,Buffer.from(w.signature,"base64")))
      throw Error("cal28x_witness_signature_invalid");
    seen.add(w.witnessId);
  }
  return {sequence:chain.sequence,head:chain.head,witnessCount:seen.size,
    checkpointSignaturesValid:true,trusted:false,status:"offline_witness_quorum_only"};
}
module.exports={verifyWitnessedRotationCheckpoint};
