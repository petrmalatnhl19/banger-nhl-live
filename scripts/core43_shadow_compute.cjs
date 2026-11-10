/* Strict bridge from verified archived inputs to GSAx sensitivity output.
 * Pure experiment: no persistence, no production predictions.
 */
"use strict";
const {auditShadowCandidates}=require("./core43_shadow_candidate_audit.cjs");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
function computeShadowCandidates({archive=[],schedules=[],shadowInputs=[],suspectStarterKeys=[]}={}){
 const candidates=auditShadowCandidates({archive,schedules,shadowInputs,suspectStarterKeys});
 return candidates.map(candidate=>{
  if(!candidate.ready)return {gameId:candidate.gameId,available:false,reason:candidate.reason,production:false};
  const rows=shadowInputs.filter(r=>String(r.game_id)===String(candidate.gameId));
  const goalie=side=>{
   const matching=rows.filter(r=>r.side===side&&String(r.goalie_id)===candidate.goalies[side].goalieId);
   if(matching.length!==1)return null;
   const r=matching[0];
   return {available:true,value:{
    gsaxPer100Shots:r.gsax/r.shots_against*100,
    shotsAgainst:r.shots_against,fetchedAt:new Date(r.gsax_fetched_at).toISOString()
   }};
  };
  const result=calculateShadow({baseline:candidate.baseline,awayGoalie:goalie("away"),
   homeGoalie:goalie("home"),asOf:candidate.asOf});
  return {gameId:candidate.gameId,...result,
   source:"archived_core41_and_verified_pregame_goalie_snapshots",
   persistable:false};
 });
}
module.exports={computeShadowCandidates};
