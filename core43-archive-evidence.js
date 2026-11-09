/* Read-only CORE 4.3 archive-to-starter evidence join.
 * Never rewrites archived forecasts or uses evidence obtained after prediction.
 */
(function(root,factory){
 const api=factory(typeof module==="object"&&module.exports?require("./core43-starter-gate.js"):root?.BangerCore43StarterGate);
 if(typeof module==="object"&&module.exports)module.exports=api;
 if(root)root.BangerCore43ArchiveEvidence=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(gate){
"use strict";
function evaluateArchiveEvidence({prediction,schedule,evidence=[],model="core41"}={}){
 const fail=reason=>({ready:false,reason,away:null,home:null});
 if(!gate?.validateFrozenEvidence)return fail("missing_validator");
 if(!prediction||!schedule||!Array.isArray(evidence))return fail("invalid_input");
 const gameId=Number(prediction.game_id);
 if(!Number.isSafeInteger(gameId)||Number(schedule.game_id)!==gameId)return fail("schedule_mismatch");
 if(prediction.away_team!==schedule.away_team||prediction.home_team!==schedule.home_team)return fail("team_mismatch");
 const timestampField={core41:"core41_predicted_at",core42:"core42_predicted_at"}[model];
 if(!timestampField)return fail("unsupported_model");
 const asOf=prediction[timestampField];
 if(typeof asOf!=="string"||!Number.isFinite(Date.parse(asOf)))return fail("missing_prediction_time");
 const game={gameId,awayTeam:schedule.away_team,homeTeam:schedule.home_team,kickoffUTC:schedule.kickoff_at};
 const pick=team=>{
  const accepted=evidence.filter(e=>e&&Number(e.game_id)===gameId&&e.team_code===team)
   .map(e=>gate.validateFrozenEvidence({
    gameId,teamCode:e.team_code,goalieId:e.goalie_id,status:e.evidence_status,
    sourceName:e.source_name,sourceUrl:e.source_url,
    sourcePublishedAt:e.source_published_at,verifiedAt:e.verified_at
   },game,asOf)).filter(v=>v.accepted);
  const ids=[...new Set(accepted.map(v=>v.goalieId))];
  if(!ids.length)return {ready:false,reason:"no_asof_confirmation",goalieId:null};
  if(ids.length!==1)return {ready:false,reason:"conflicting_confirmations",goalieId:null};
  return {ready:true,reason:null,goalieId:ids[0]};
 };
 const away=pick(game.awayTeam),home=pick(game.homeTeam);
 return {ready:away.ready&&home.ready,reason:away.ready&&home.ready?null:"incomplete_starter_evidence",
  gameId,model,predictionAt:asOf,away,home,experimental:true};
}
return {evaluateArchiveEvidence};
});
