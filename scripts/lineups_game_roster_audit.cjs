'use strict';
// LINEUPS-03.6: verify long shift participants against game-specific NHL boxscore.
// This is diagnostic evidence only, never publishes observed PP/PK units.
function verifyLongShiftRoles(shiftPayload,boxscore,gameId){
 const data=Array.isArray(shiftPayload?.data)?shiftPayload.data:[];
 const teams=[['awayTeam',boxscore?.awayTeam],['homeTeam',boxscore?.homeTeam]];
 const roster=boxscore?.playerByGame;
 if(!roster||teams.some(([side,t])=>!Number.isInteger(t?.id)||!roster[side]))return {status:'unverified',reason:'missing-game-roster',longShiftCount:0};
 const byTeam=new Map();
 for(const [side,t] of teams){
  const group=roster[side];
  const goalies=Array.isArray(group.goalies)?group.goalies:[];
  const skaters=[...(Array.isArray(group.forwards)?group.forwards:[]),...(Array.isArray(group.defense)?group.defense:[])];
  if(!goalies.length||!skaters.length)return {status:'unverified',reason:'incomplete-game-roster',longShiftCount:0};
  const ids=items=>new Set(items.map(x=>x.playerId).filter(Number.isInteger));
  const g=ids(goalies),s=ids(skaters);
  if([...g].some(id=>s.has(id)))return {status:'unverified',reason:'ambiguous-roles',longShiftCount:0};
  byTeam.set(t.id,{g,s});
 }
 const long=data.filter(r=>Number(r?.gameId)===Number(gameId)&&r?.typeCode===517&&r?.period>=1&&r.period<=3&&typeof r.startTime==='string'&&typeof r.endTime==='string').filter(r=>{
  const time=x=>{const m=/^(\\d{1,2}):(\\d{2})$/.exec(x);return m&&+m[2]<60?+m[1]*60+ +m[2]:NaN};
  const a=time(r.startTime),b=time(r.endTime);return Number.isFinite(a)&&Number.isFinite(b)&&b<=1200&&b-a>180;
 });
 let goalie=0,skater=0,unknown=0;
 for(const r of long){const team=byTeam.get(r.teamId);if(team?.g.has(r.playerId))goalie++;else if(team?.s.has(r.playerId))skater++;else unknown++}
 return {status:unknown?'partial':'roles-checked',longShiftCount:long.length,goalieLongShifts:goalie,skaterLongShifts:skater,unknownLongShifts:unknown,verifiedUnits:false};
}
module.exports={verifyLongShiftRoles};
