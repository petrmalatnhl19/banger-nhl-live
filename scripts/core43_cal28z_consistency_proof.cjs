"use strict";
// CAL-28Z: bounded full-history replay as an append-only consistency proof.
// Unlike a Merkle proof, this requires disclosure of the entire signed prefix.
const {verifyWitnessedRotationCheckpoint}=require("./core43_cal28x_checkpoint_witness.cjs");
const {hashEntry}=require("./core43_cal28w_rotation_history.cjs");
const HEX=/^[a-f0-9]{64}$/;
function verifyAppendOnlyCheckpointViews(older,newer,authorityKey,auditorId,witnessKeys) {
  function checkView(v) {
    if(!v||typeof v!=="object"||Array.isArray(v)||
       Object.keys(v).sort().join(",")!=="anchor,entries,observerId,witnesses"||
       typeof v.observerId!=="string"||!/^[A-Za-z0-9._:-]{3,128}$/.test(v.observerId))
      throw Error("cal28z_invalid_view_schema");
    if(v.anchor.sequence!==0||!HEX.test(v.anchor.head))
      throw Error("cal28z_genesis_anchor_required");
    return verifyWitnessedRotationCheckpoint(v.entries,v.anchor,authorityKey,
      auditorId,v.witnesses,witnessKeys,2);
  }
  if(!older||!newer||older.observerId===newer.observerId)
    throw Error("cal28z_distinct_observers_required");
  const a=checkView(older),b=checkView(newer);
  if(older.anchor.head!==newer.anchor.head)
    throw Error("cal28z_different_genesis");
  if(a.sequence>=b.sequence)
    throw Error("cal28z_strict_extension_required");
  if(older.entries.length>=newer.entries.length)
    throw Error("cal28z_missing_extension");
  for(let i=0;i<older.entries.length;i++){
    if(hashEntry(older.entries[i])!==hashEntry(newer.entries[i])||
       older.entries[i].signature!==newer.entries[i].signature)
      throw Error("cal28z_history_prefix_mismatch");
  }
  if(hashEntry(newer.entries[older.entries.length-1])!==a.head)
    throw Error("cal28z_old_checkpoint_not_in_new_history");
  const oldWitnesses=new Set(older.witnesses.map(w=>w.witnessId));
  if(!newer.witnesses.some(w=>!oldWitnesses.has(w.witnessId)))
    throw Error("cal28z_no_additional_witness");
  return {oldSequence:a.sequence,newSequence:b.sequence,oldHead:a.head,newHead:b.head,
    appendOnlyVerified:true,trusted:false,status:"offline_full_replay_consistency_only"};
}
module.exports={verifyAppendOnlyCheckpointViews};
