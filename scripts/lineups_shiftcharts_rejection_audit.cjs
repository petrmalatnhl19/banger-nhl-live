'use strict';
// LINEUPS-03.3: classify rejected shiftcharts records without player-identifying logs.
const {normalizeShifts}=require('./lineups_observed_units.cjs');
const {clock}=require('./lineups_shiftcharts_adapter.cjs');
function classifyShiftRows(payload,gameId){
 const reasons={wrongGame:0,invalidIdentity:0,invalidPeriod:0,nonShiftEvent:0,invalidClock:0,invalidInterval:0,normalizationRejected:0};
 if(!Array.isArray(payload?.data))return {reasons,accepted:0,rejected:0,status:'invalid-response'};
 let accepted=0;
 for(const r of payload.data){
  let reason=null;
  if(Number(r?.gameId)!==Number(gameId))reason='wrongGame';
  else if(!Number.isInteger(r?.playerId)||!Number.isInteger(r?.teamId))reason='invalidIdentity';
  else if(!Number.isInteger(r?.period)||r.period<1||r.period>3)reason='invalidPeriod';
  else if(r?.typeCode!==517)reason='nonShiftEvent';
  else {
   const start=clock(r.startTime),end=clock(r.endTime);
   if(start===null||end===null||end>1200)reason='invalidClock';
   else if(end<=start)reason='invalidInterval';
   else if(normalizeShifts([{playerId:r.playerId,teamId:r.teamId,start:(r.period-1)*1200+start,end:(r.period-1)*1200+end}]).length!==1)reason='normalizationRejected';
  }
  if(reason)reasons[reason]++;else accepted++;
 }
 return {reasons,accepted,rejected:payload.data.length-accepted,status:'classified'};
}
module.exports={classifyShiftRows};
