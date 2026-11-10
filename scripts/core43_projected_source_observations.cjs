/* Read-only bridge from native RotoWire snapshots to projected goalie observations.
 * Source observation time is not the source's original publication time.
 * No probabilities, confirmations, GSAx or predictions are fabricated.
 */
"use strict";
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function projectedObservations(snapshot,{asOf}={}){
 const fail=reason=>({available:false,reason,observations:[],production:false,persistable:false});
 if(!snapshot||!Array.isArray(snapshot.games)||!validTime(snapshot.updatedAt)||!validTime(asOf))
  return fail("missing_snapshot_or_time");
 if(Date.parse(snapshot.updatedAt)>Date.parse(asOf))
  return fail("snapshot_after_asof");
 if(Date.parse(asOf)-Date.parse(snapshot.updatedAt)>2*60*60*1000)
  return fail("stale_snapshot");
 const seen=new Map(),conflicts=new Set();
 for(const row of snapshot.games){
  if(!row||row.status!=="projected"||!Number.isSafeInteger(row.gameId)||row.gameId<=0
    ||typeof row.team!=="string"||!/^\d+$/.test(String(row.goalieId||""))
    ||typeof row.source!=="string"||!row.source.startsWith("https://"))continue;
  const key=row.gameId+"|"+row.team;
  if(seen.has(key)&&seen.get(key).goalieId!==String(row.goalieId)){
   conflicts.add(key);continue;
  }
  seen.set(key,{gameId:row.gameId,teamCode:row.team,goalieId:String(row.goalieId),
   goalieName:row.goalie,sourceUrl:row.source,status:"projected",
   observedAt:snapshot.updatedAt,sourcePublishedAt:null,
   probability:null,gsaxPer100Shots:null,
   eligibleForProjectedCalculation:false});
 }
 const observations=[...seen.entries()].filter(([key])=>!conflicts.has(key)).map(([,value])=>value);
 return {available:true,production:false,persistable:false,
  observations,conflictCount:conflicts.size,
  note:"Observed projection only: no calibrated start probability or per-report publication time"};
}
module.exports={projectedObservations};
