"use strict";
/* Pure preparation gate for NEW pregame shadow candidates; never writes archive rows. */
const {reconcileIdentities}=require("./core43_rotowire_identity_reconcile.cjs");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function preparePregameGoalieIdentity({gameId,teamCode,predictionAt,kickoffAt,observations=[],identities=[]}={}){
 const fail=reason=>({ready:false,reason,goalieId:null,starterStatus:null,production:false,persistable:false});
 if(!gameId||!/^[A-Z]{3}$/.test(teamCode||"")||!valid(predictionAt)||!valid(kickoffAt)||Date.parse(predictionAt)>=Date.parse(kickoffAt))return fail("invalid_pregame_context");
 const scoped=observations.filter(x=>String(x.game_id)===String(gameId)&&x.team_code===teamCode&&valid(x.observed_at)&&valid(x.source_snapshot_at)&&Date.parse(x.source_snapshot_at)<=Date.parse(x.observed_at)&&Date.parse(x.observed_at)<=Date.parse(predictionAt));
 if(!scoped.length)return fail("missing_pregame_observation");
 const newest=Math.max(...scoped.map(x=>Date.parse(x.observed_at)));
 const latest=scoped.filter(x=>Date.parse(x.observed_at)===newest);
 if(latest.some(x=>!["projected","confirmed"].includes(x.observed_status)))return fail("invalid_latest_status");
 const mapped=reconcileIdentities({observations:latest,identities,asOf:predictionAt});
 if(mapped.some(x=>!x.identityResolved))return fail(mapped.some(x=>x.reason==="identity_ambiguous")?"ambiguous_goalie_identity":"unresolved_goalie_identity");
 const ids=new Set(mapped.map(x=>x.goalieId));
 if(ids.size!==1)return fail("conflicting_latest_goalies");
 return {ready:true,reason:null,goalieId:[...ids][0],starterStatus:"projected",
  observedStatus:latest.every(x=>x.observed_status==="confirmed")?"confirmed":"projected",
  observedAt:new Date(newest).toISOString(),sourcePublishedAt:null,
  verifiedStarter:false,production:false,persistable:false,
  note:"Identity-only candidate. Confirmed RotoWire observation is not verified publication evidence."};
}
module.exports={preparePregameGoalieIdentity};
