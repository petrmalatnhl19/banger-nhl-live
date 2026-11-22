'use strict';
// LINEUPS-03.11: simultaneous five-skater overlap, candidate-only.
function simultaneousFiveSkaterWindows(shifts,teamIds,seconds=3600){
 const invalid={status:'invalid',windows:[],seconds:0,verifiedStrength:false};
 if(!Array.isArray(shifts)||!Array.isArray(teamIds)||teamIds.length!==2||new Set(teamIds).size!==2||!teamIds.every(Number.isInteger)||!Number.isInteger(seconds)||seconds<=0)return invalid;
 const events=new Map(),seen=new Set();
 for(const s of shifts){
  if(!teamIds.includes(s?.teamId))continue;
  if(!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>seconds||s.end<=s.start)return {...invalid,status:'unverified',reason:'invalid-shift'};
  const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(seen.has(key))return {...invalid,status:'unverified',reason:'duplicate-shift'};seen.add(key);
  for(const [time,delta] of [[s.start,1],[s.end,-1]]){if(!events.has(time))events.set(time,[]);events.get(time).push({teamId:s.teamId,playerId:s.playerId,delta})}
 }
 const times=[...new Set([0,seconds,...events.keys()])].sort((a,b)=>a-b),active=new Map(teamIds.map(id=>[id,new Map()]));const windows=[];
 for(let i=0;i<times.length-1;i++){
  const t=times[i];for(const e of events.get(t)||[]){const players=active.get(e.teamId),n=(players.get(e.playerId)||0)+e.delta;if(n<0)return {...invalid,status:'unverified',reason:'unbalanced-shifts'};if(n===0)players.delete(e.playerId);else players.set(e.playerId,n)}
  const valid=teamIds.every(id=>active.get(id).size===5&&[...active.get(id).values()].every(n=>n===1));
  if(!valid)continue;
  const prev=windows[windows.length-1];if(prev?.end===t)prev.end=times[i+1];else windows.push({start:t,end:times[i+1]});
 }
 return {status:'candidate-only',windows,seconds:windows.reduce((n,w)=>n+w.end-w.start,0),verifiedStrength:false,warning:'Five skaters on each side is not independently verified even-strength play.'};
}
module.exports={simultaneousFiveSkaterWindows};
