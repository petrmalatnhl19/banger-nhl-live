/* Read-only, as-of identity reconciliation for archived RotoWire observations.
 * Identity mapping is NOT evidence of a confirmed starter at prediction time.
 */
"use strict";
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const normalize=x=>typeof x==="string"?x.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,""):"";
function reconcileIdentities({observations=[],identities=[],asOf}={}){
 const cutoff=asOf===undefined?null:validTime(asOf)?Date.parse(asOf):NaN;
 if(Number.isNaN(cutoff))throw Error("invalid_asof");
 const byName=new Map();
 for(const row of identities){
  if(!row||typeof row.team_code!=="string"||!/^[A-Z]{3}$/.test(row.team_code)||!/^[0-9]+$/.test(String(row.goalie_id||"")))continue;
  // A later-discovered mapping cannot be used to claim identity at an earlier freeze.
  if(!validTime(row.observed_at))continue;
  const name=normalize(row.normalized_name||row.goalie_name);
  if(!name)continue;
  const key=row.team_code+"|"+name;
  if(!byName.has(key))byName.set(key,[]);
  byName.get(key).push(row);
 }
 return observations.filter(o=>o&&["confirmed","projected"].includes(o.observed_status)).map(o=>{
  const observed=validTime(o.observed_at)?Date.parse(o.observed_at):NaN;
  const snapshot=validTime(o.source_snapshot_at)?Date.parse(o.source_snapshot_at):NaN;
  const freeze=cutoff===null?observed:cutoff;
  const validObservation=Number.isFinite(observed)&&Number.isFinite(snapshot)&&snapshot<=observed&&observed<=freeze;
  const key=String(o.team_code)+"|"+normalize(o.goalie_name);
  const possible=(byName.get(key)||[]).filter(x=>Date.parse(x.observed_at)<=freeze);
  const ids=new Set(possible.map(x=>String(x.goalie_id)));
  const goalieId=validObservation&&ids.size===1?[...ids][0]:null;
  const reason=!validObservation?"invalid_or_late_observation":ids.size===0?"identity_missing_asof":ids.size>1?"identity_ambiguous":null;
  return {gameId:o.game_id,teamCode:o.team_code,goalieName:o.goalie_name,goalieId,
   observedAt:o.observed_at,sourceSnapshotAt:o.source_snapshot_at,
   identityResolved:!!goalieId,reason,observedStatus:o.observed_status,
   verifiedStarter:false,eligibleForPromotion:false};
 });
}
module.exports={reconcileIdentities};
