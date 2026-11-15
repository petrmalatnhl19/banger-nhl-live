"use strict";
// CAL-28Y: compare two separately supplied, signed offline checkpoint views.
// This does not prove independent hosts or absence of undisclosed forks.
const {verifyWitnessedRotationCheckpoint}=require("./core43_cal28x_checkpoint_witness.cjs");
function verifyCheckpointViewConsistency(left,right,authorityKey,auditorId,pinnedWitnessKeys) {
  function validate(view) {
    if(!view||typeof view!=="object"||Array.isArray(view)||
      Object.keys(view).sort().join(",")!=="anchor,entries,observerId,witnesses"||
      typeof view.observerId!=="string"||
      !/^[A-Za-z0-9._:-]{3,128}$/.test(view.observerId))
      throw Error("cal28y_invalid_view_schema");
    return verifyWitnessedRotationCheckpoint(view.entries,view.anchor,authorityKey,
      auditorId,view.witnesses,pinnedWitnessKeys,2);
  }
  if(!left||!right||left.observerId===right.observerId)
    throw Error("cal28y_distinct_observers_required");
  const a=validate(left),b=validate(right);
  if(a.sequence!==b.sequence)
    throw Error("cal28y_different_sequence_requires_consistency_proof");
  if(a.head!==b.head)
    throw Error("cal28y_conflicting_checkpoint_heads");
  const leftWitnessIds=new Set(left.witnesses.map(w=>w.witnessId));
  if(!right.witnesses.some(w=>!leftWitnessIds.has(w.witnessId)))
    throw Error("cal28y_no_independent_witness_overlap");
  return {sequence:a.sequence,head:a.head,viewsConsistent:true,trusted:false,
    status:"offline_cross_view_consistency_only"};
}
module.exports={verifyCheckpointViewConsistency};
