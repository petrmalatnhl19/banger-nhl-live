/* CORE 4.3 goalie confirmation gate.
 * Provider-agnostic evidence validation. This does not infer starters from
 * NHL box scores or roster lists. Requires an explicit pregame confirmation.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43StarterGate=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const date=s=>typeof s==="string"?Date.parse(s):NaN;
function validateEvidence(e,game){
 const fail=reason=>({accepted:false,reason});
 if(!e||!game||!Number.isFinite(date(game.kickoffUTC)))return fail("invalid_game");
 if(e.gameId!==game.gameId)return fail("game_mismatch");
 if(![game.awayTeam,game.homeTeam].includes(e.teamCode))return fail("team_mismatch");
 if(!/^\d+$/.test(String(e.goalieId||"")))return fail("invalid_goalie_id");
 if(e.status!=="confirmed")return fail("not_confirmed");
 if(typeof e.sourceName!=="string"||e.sourceName.trim().length<3)return fail("missing_source");
 if(typeof e.sourceUrl!=="string"||!/^https:\/\//.test(e.sourceUrl))return fail("missing_source_url");
 const published=date(e.sourcePublishedAt),verified=date(e.verifiedAt),kickoff=date(game.kickoffUTC);
 // When validating a frozen prediction, evidence must exist at prediction time,
 // not merely before puck drop. Preserve the legacy pregame-only mode when
 // no prediction timestamp is supplied by existing callers.
 const asOf=game.predictionAt===undefined?kickoff:date(game.predictionAt);
 if(!Number.isFinite(asOf)||asOf>kickoff)return fail("invalid_prediction_time");
 if(!Number.isFinite(published)||!Number.isFinite(verified))return fail("missing_timestamps");
 if(published>verified)return fail("verification_before_publication");
 if(published>=kickoff||verified>=kickoff)return fail("not_pregame");
 if(game.predictionAt!==undefined&&(published>asOf||verified>asOf))return fail("evidence_after_prediction");
 return {accepted:true,reason:null,goalieId:String(e.goalieId),teamCode:e.teamCode,gameId:e.gameId,
  sourceName:e.sourceName,sourceUrl:e.sourceUrl,sourcePublishedAt:e.sourcePublishedAt,verifiedAt:e.verifiedAt};
}
// Explicit entry point for archived/frozen predictions. Fail closed if the
// prediction timestamp is missing; do not silently fall back to kickoff.
function validateFrozenEvidence(e,game,predictionAt){
 if(typeof predictionAt!=="string"||!Number.isFinite(date(predictionAt)))
  return {accepted:false,reason:"missing_prediction_time"};
 return validateEvidence(e,{...game,predictionAt});
}
return {validateEvidence,validateFrozenEvidence};
});
