'use strict';
// LINEUPS-03: conservative offline orchestration, never promotes partial data.
const {parseShiftCharts}=require('./lineups_shiftcharts_adapter.cjs');
const {observedUnits}=require('./lineups_observed_units.cjs');
function analyzeObservedUnits({payload,gameId,teamId,roster,windows,minSeconds=15}={}){
  const parsed=parseShiftCharts(payload,gameId);
  const base={status:'unverified',units:[],sourceStatus:parsed.status,warning:'Bez ověřené úplnosti střídání a početního stavu nelze potvrdit skutečné jednotky.'};
  if(parsed.status!=='partial'||parsed.rejected!==0||!Array.isArray(roster?.skaters)||!Array.isArray(roster?.goalies)
    ||!Number.isInteger(teamId)||!Array.isArray(windows)||windows.length===0)return base;
  const skaters=new Set(roster.skaters),goalies=new Set(roster.goalies);
  if(skaters.size!==roster.skaters.length||goalies.size!==roster.goalies.length
    ||[...skaters].some(id=>!Number.isInteger(id)||goalies.has(id)))return base;
  const own=parsed.shifts.filter(s=>s.teamId===teamId);
  if(!own.length||parsed.shifts.some(s=>s.teamId===teamId&&!skaters.has(s.playerId)&&!goalies.has(s.playerId)))return base;
  const valid=own.filter(s=>skaters.has(s.playerId));
  if(!valid.length)return base;
  // All windows must carry explicit, trusted strength evidence. No strength inference from penalty events.
  if(windows.some(w=>w?.verified!==true||!Number.isInteger(w.teamSkaters)
    ||!Number.isInteger(w.opponentSkaters)||!Number.isFinite(w.start)||!Number.isFinite(w.end)
    ||w.end<=w.start||w.start<0||w.end>3600))return base;
  const units=observedUnits({shifts:valid,windows,teamId,minSeconds});
  return {status:'candidate-only',units,sourceStatus:parsed.status,
    warning:'Kandidátní kombinace z překryvů střídání. Kompletnost a početní stav vyžadují nezávislé ověření.'};
}
module.exports={analyzeObservedUnits};
