'use strict';
// LINEUPS-03: conservative NHL shiftcharts adapter, no network access.
// Input: NHL Stats REST {data:[{gameId,period,playerId,teamId,startTime,endTime,...}]}.
// The caller supplies trusted team IDs and skater IDs from the game's roster.
// Only regulation periods 1–3; overtime lengths need separate game-specific rules.
const clock=s=>{if(typeof s!=='string'||!/^\d{1,2}:\d{2}$/.test(s))return null;const [m,sec]=s.split(':').map(Number);if(sec>=60||m*60+sec>1200)return null;return m*60+sec};
function convertNhlShiftcharts(raw,{gameId,teamSkaters}={}){
  const errors=[];
  if(!/^\d{10}$/.test(String(gameId||''))||!teamSkaters||typeof teamSkaters!=='object')
    return {status:'invalid-config',shifts:[],errors:['Missing game ID or roster mapping']};
  if(!Array.isArray(raw?.data)||raw.data.length===0)
    return {status:'unavailable',shifts:[],errors:['No shift records supplied']};
  const shifts=[];let rejected=0,goalies=0;
  for(const row of raw.data){
    const period=Number(row?.period),playerId=Number(row?.playerId),teamId=Number(row?.teamId);
    const start=clock(row?.startTime),end=clock(row?.endTime);
    const allowed=teamSkaters[String(teamId)];
    if(!Number.isInteger(period)||period<1||period>3||!Number.isInteger(playerId)||!Number.isInteger(teamId)
      ||!allowed||!Array.isArray(allowed.skaters)||!Array.isArray(allowed.goalies)
      ||start===null||end===null||end<=start||end-start>180
      ||(row.gameId!==undefined&&String(row.gameId)!==String(gameId))){rejected++;continue}
    if(allowed.goalies.includes(playerId)){goalies++;continue}
    if(!allowed.skaters.includes(playerId)){rejected++;continue}
    shifts.push({playerId,teamId,start:(period-1)*1200+start,end:(period-1)*1200+end});
  }
  // Partial source cannot be treated as verified. Keep diagnostic records only.
  const status=rejected?'partial':shifts.length?'parsed':'unavailable';
  if(rejected)errors.push(rejected+' invalid or unmatched shifts');
  return {status,shifts:status==='parsed'?shifts:[],errors,rejected,goalies,accepted:shifts.length};
}
module.exports={clock,convertNhlShiftcharts};
