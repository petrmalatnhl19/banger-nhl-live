"use strict";
/* Optional read-only integration of frozen goalie identity + evidence into CORE 4.3 game diagnostics. */
const {inspectGame}=require("./core43_end_to_end_readiness.cjs");
const {classifyStarter}=require("./core43_starter_readiness.cjs");
const norm=s=>typeof s==="string"?s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,""):"";
const time=s=>typeof s==="string"&&Number.isFinite(Date.parse(s));
function inspectGameWithStarterEvidence({prediction,schedule,goalies=[],identityMap=[],starterEvidence=[],gsax=[],fatigue=[],absences=[]}={}){
 const baseline=inspectGame({prediction,schedule,goalies,gsax,fatigue,absences});
 if(!baseline.available)return baseline;
 const asOf=baseline.frozenPredictionAt,asOfMs=Date.parse(asOf),sides={};
 for(const side of ["away","home"]){
  const team=baseline.sides[side].team;
  const rows=goalies.filter(r=>String(r.game_id)===String(prediction.game_id)&&r.team_code===team&&time(r.observed_at)&&
    Date.parse(r.observed_at)<=asOfMs&&time(r.source_snapshot_at)&&Date.parse(r.source_snapshot_at)<=asOfMs);
  rows.sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));
  const latest=rows[0];
  if(!latest){
   sides[side]={...baseline.sides[side],starterReadiness:{status:"unavailable",reason:"missing_pregame_observation"}};
   continue;
  }
  const ids=[...new Set(identityMap.filter(m=>m.team_code===team&&norm(m.goalie_name)===norm(latest.goalie_name)&&
    time(m.observed_at)&&Date.parse(m.observed_at)<=asOfMs).map(m=>String(m.goalie_id)).filter(Boolean))];
  const starterReadiness=ids.length===1?
    classifyStarter({gameId:prediction.game_id,teamCode:team,goalieName:latest.goalie_name,goalieId:ids[0],
      predictionAt:asOf,observations:rows,evidence:starterEvidence}):
    {status:"unavailable",reason:ids.length?"ambiguous_frozen_goalie_id":"missing_frozen_goalie_id",production:false,persistable:false};
  sides[side]={...baseline.sides[side],starterReadiness};
 }
 const statuses=Object.values(sides).map(s=>s.starterReadiness.status);
 const starterReadiness=statuses.every(s=>s==="ready_confirmed")?"ready_confirmed":
   statuses.every(s=>s==="ready_confirmed"||s==="ready_projected")?"ready_projected":"unavailable";
 return {...baseline,sides,starterReadiness,readyForCalibratedForecast:false,production:false,persistable:false,
   warning:"Read-only historical diagnostic. Starter readiness does not imply complete CORE 4.3 forecast readiness."};
}
module.exports={inspectGameWithStarterEvidence};
