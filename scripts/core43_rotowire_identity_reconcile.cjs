/* Read-only identity reconciliation for archived RotoWire observations.
 * Identity mapping is NOT evidence of a confirmed starter at prediction time.
 */
"use strict";
function reconcileIdentities({observations=[],identities=[]}={}){
 const byName=new Map();
 for(const row of identities){
  if(!row||typeof row.team_code!=="string"||typeof row.normalized_name!=="string"||!/^\d+$/.test(String(row.goalie_id||"")))continue;
  const key=row.team_code+"|"+row.normalized_name.trim().toLowerCase();
  if(!byName.has(key))byName.set(key,new Set());
  byName.get(key).add(String(row.goalie_id));
 }
 return observations.filter(o=>o.observed_status==="confirmed").map(o=>{
  const ids=byName.get(String(o.team_code)+"|"+String(o.goalie_name||"").trim().toLowerCase())||new Set();
  const goalieId=ids.size===1?[...ids][0]:null;
  return {gameId:o.game_id,teamCode:o.team_code,goalieName:o.goalie_name,goalieId,
   observedAt:o.observed_at,sourceSnapshotAt:o.source_snapshot_at,
   identityResolved:ids.size===1,reason:ids.size===0?"identity_missing":ids.size>1?"identity_ambiguous":null,
   verifiedStarter:false,eligibleForPromotion:false};
 });
}
module.exports={reconcileIdentities};
