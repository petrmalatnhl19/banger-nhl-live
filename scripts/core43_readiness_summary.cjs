"use strict";
/* Explain monitor outcomes without changing experimental capture or evidence gates. */
function summarizeReadiness(result){
 const sides=result.goalieDiagnostics?.sides||[];
 const missing=[];
 if(!result.baselineReady)missing.push("core42_baseline");
 for(const side of sides){
  if(side.reason==="missing_pregame_observation")missing.push(side.side+"_goalie_observation");
  else if(side.reason==="conflicting_latest_observations"||side.reason==="invalid_latest_status")missing.push(side.side+"_goalie_conflict");
  else if(side.reason==="missing_matching_verified_starter_evidence")missing.push(side.side+"_verified_starter_evidence");
 }
 const reason=String(result.reason||"");
 if(reason.includes("gsax"))missing.push("archived_pregame_gsax");
 if(reason.includes("schedule"))missing.push("pregame_schedule");
 if(reason.includes("baseline")&&!missing.includes("core42_baseline"))missing.push("core42_baseline");
 if(reason.includes("observation")&&!missing.some(x=>x.endsWith("_goalie_observation")))missing.push("pregame_goalie_observation");
 if(reason.includes("identity"))missing.push("goalie_identity");
 if(reason.includes("capture")||reason.includes("context"))missing.push("capture_time_or_context");
 if(!result.ready && !missing.length)missing.push("other_capture_gate");
 return {experimentalReady:result.ready===true,verifiedStarters:sides.length===2&&sides.every(s=>s.verifiedEvidence===true),missing:[...new Set(missing)],captureReason:result.reason||null,archived:false};
}
module.exports={summarizeReadiness};
