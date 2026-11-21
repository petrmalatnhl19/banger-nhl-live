'use strict';
// LINEUPS-03.8: roster-grounded skater shift extraction. Never labels units verified.
const {clock}=require('./lineups_shiftcharts_adapter.cjs');
const {normalizeShifts}=require('./lineups_observed_units.cjs');
function extractRosterSkaterShifts(payload,boxscore,gameId){
 const base={status:'unverified',shifts:[],skaterShiftCount:0,goalieShiftCount:0,rejected:0,verifiedUnits:false};
 const roster=boxscore?.playerByGameStats;
 if(!Array.isArray(payload?.data)||!roster||!Number.isInteger(boxscore?.awayTeam?.id)||!Number.isInteger(boxscore?.homeTeam?.id))return {...base,reason:'missing-data'};
 const byTeam=new Map();
 for(const side of ['awayTeam','homeTeam']){
  const teamId=boxscore[side].id,group=roster[side];
  if(!group||!Array.isArray(group.goalies)||!Array.isArray(group.forwards)||!Array.isArray(group.defense))return {...base,reason:'incomplete-roster'};
  const ids=items=>new Set(items.map(x=>x.playerId));
  const skaters=ids([...group.forwards,...group.defense]),goalies=ids(group.goalies);
  if(!skaters.size||!goalies.size||[...skaters,...goalies].some(id=>!Number.isInteger(id))||[...skaters].some(id=>goalies.has(id)))return {...base,reason:'invalid-roster'};
  byTeam.set(teamId,{skaters,goalies});
 }
 let goalieShiftCount=0,rejected=0;const candidates=[];
 for(const r of payload.data){
  if(Number(r?.gameId)!==Number(gameId)||r?.typeCode!==517){rejected++;continue}
  const role=byTeam.get(r.teamId);
  const a=clock(r.startTime),b=clock(r.endTime);
  if(!role||!Number.isInteger(r.playerId)||!Number.isInteger(r.period)||r.period<1||r.period>3||a===null||b===null||b<=a||b>1200){rejected++;continue}
  if(role.goalies.has(r.playerId)){goalieShiftCount++;continue}
  if(!role.skaters.has(r.playerId)){rejected++;continue}
  candidates.push({playerId:r.playerId,teamId:r.teamId,start:(r.period-1)*1200+a,end:(r.period-1)*1200+b});
 }
 const shifts=normalizeShifts(candidates);
 rejected+=candidates.length-shifts.length;
 return {status:rejected?'partial':'roster-filtered',shifts,skaterShiftCount:shifts.length,goalieShiftCount,rejected,verifiedUnits:false,
  warning:'Roster-filtered shifts do not establish verified 5v5 or PP/PK strength windows.'};
}
module.exports={extractRosterSkaterShifts};
