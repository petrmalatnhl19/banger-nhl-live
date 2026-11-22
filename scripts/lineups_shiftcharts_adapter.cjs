'use strict';
// LINEUPS-03.1: strict NHL Stats shiftcharts adapter; no network calls or UI.
const {normalizeShifts}=require('./lineups_observed_units.cjs');
const clock=s=>{if(typeof s!=='string'||!/^\d{1,2}:\d{2}$/.test(s))return null;const [m,sec]=s.split(':').map(Number);return sec<60?m*60+sec:null};
function parseShiftCharts(payload,gameId){
  if(!/^\d{10}$/.test(String(gameId)))return {status:'invalid-game',shifts:[],rejected:0};
  if(!payload||!Array.isArray(payload.data))return {status:'invalid-response',shifts:[],rejected:0};
  if(!payload.data.length)return {status:'unavailable',shifts:[],rejected:0};
  const shifts=[];let rejected=0;
  for(const row of payload.data){
    if(Number(row.gameId)!==Number(gameId)||!Number.isInteger(row.playerId)||!Number.isInteger(row.teamId)
      ||!Number.isInteger(row.period)||row.period<1||row.period>3||row.typeCode!==517){rejected++;continue}
    const start=clock(row.startTime),end=clock(row.endTime);
    if(start===null||end===null||end<=start||end>1200){rejected++;continue}
    shifts.push({playerId:row.playerId,teamId:row.teamId,start:(row.period-1)*1200+start,end:(row.period-1)*1200+end});
  }
  const valid=normalizeShifts(shifts);
  return {status:valid.length?'partial':'unavailable',shifts:valid,rejected:rejected+shifts.length-valid.length,
    warning:'Střídání sama o sobě neověřují početní stav, gólmany ani kompletnost zápisu. Nezobrazovat jako potvrzené jednotky.'};
}
module.exports={clock,parseShiftCharts};
