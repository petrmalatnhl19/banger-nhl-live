/* Experimental pregame revision decision: immutable original forecast.
 * A revision is a new record, never an overwrite of a historical prediction.
 */
(function(root,factory){const api=factory(typeof module==="object"&&module.exports?require("./core43-archive-evidence.js"):root?.BangerCore43ArchiveEvidence);if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43RevisionGate=api;})(typeof globalThis!=="undefined"?globalThis:null,function(archive){
"use strict";
function proposeRevision({prediction,schedule,evidence,asOf,model="core41"}={}){
 const fail=reason=>({eligible:false,reason,proposal:null});
 const t=typeof asOf==="string"?Date.parse(asOf):NaN;
 const kickoff=typeof schedule?.kickoff_at==="string"?Date.parse(schedule.kickoff_at):NaN;
 const field={core41:"core41_predicted_at",core42:"core42_predicted_at"}[model];
 const original=field?Date.parse(prediction?.[field]):NaN;
 if(!field)return fail("unsupported_model");
 if(!Number.isFinite(t)||!Number.isFinite(kickoff)||!Number.isFinite(original))return fail("missing_timestamps");
 if(t<=original)return fail("revision_not_after_original");
 if(t>=kickoff)return fail("revision_not_pregame");
 if(!archive?.evaluateArchiveEvidence)return fail("missing_archive_validator");
 // Validate against a virtual prediction timestamp, without mutating the archive.
 const virtual={...prediction,[field]:asOf};
 const checked=archive.evaluateArchiveEvidence({prediction:virtual,schedule,evidence,model});
 if(!checked.ready)return fail(checked.reason);
 return {eligible:true,reason:null,proposal:{
  experimental:true,production:false,gameId:checked.gameId,model,
  originalPredictedAt:prediction[field],revisionAsOf:asOf,
  awayGoalieId:checked.away.goalieId,homeGoalieId:checked.home.goalieId,
  policy:"new_revision_only_never_overwrite_original"
 }};
}
return {proposeRevision};
});
