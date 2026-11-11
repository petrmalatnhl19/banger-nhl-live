"use strict";
/* Pure shadow preparation: join frozen-time goalie identity to archived GSAx. No writes. */
const {preparePregameGoalieIdentity}=require("./core43_new_pregame_goalie_identity.cjs");
const {goalieSnapshot}=require("../core43-season-gsax.js");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function preparePregameGoalieGsax({gameId,teamCode,predictionAt,kickoffAt,observations=[],identities=[],gsaxRows=[],gsaxFetchedAt}={}){
 const fail=(reason,identity)=>({available:false,reason,goalieId:identity?.goalieId||null,starterStatus:"projected",production:false,persistable:false});
 const identity=preparePregameGoalieIdentity({gameId,teamCode,predictionAt,kickoffAt,observations,identities});
 if(!identity.ready)return fail(identity.reason,identity);
 if(!valid(gsaxFetchedAt)||Date.parse(gsaxFetchedAt)>Date.parse(predictionAt))return fail("gsax_not_available_at_prediction",identity);
 const snapshot=goalieSnapshot(gsaxRows,{goalieId:identity.goalieId,team:teamCode,fetchedAt:gsaxFetchedAt,kickoff:kickoffAt,minShots:30});
 if(!snapshot.available)return fail("gsax_"+snapshot.reason,identity);
 return {available:true,reason:null,goalieId:identity.goalieId,starterStatus:"projected",
  observedStatus:identity.observedStatus,verifiedStarter:false,sourcePublishedAt:null,
  observedAt:identity.observedAt,gsax:snapshot.value.gsax,gsaxPer100Shots:snapshot.value.gsaxPer100Shots,
  shotsAgainst:snapshot.value.shotsAgainst,gsaxFetchedAt,
  production:false,persistable:false,experimental:true,
  note:"Identity and GSAx only; no verified starter, calibrated probability or forecast."};
}
module.exports={preparePregameGoalieGsax};
