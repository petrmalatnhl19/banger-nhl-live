'use strict';
// LINEUPS-03.10: exact five-skater combinations observed in shift overlap.
// No inference of 5v5, PP, PK or verified lineup status.
function observedFiveSkaterCombinations(shifts,teamIds,seconds=3600){
 if(!Array.isArray(shifts)||!Array.isArray(teamIds)||teamIds.length!==2||new Set(teamIds).size!==2||!teamIds.every(Number.isInteger)||!Number.isInteger(seconds)||seconds<=0)return {status:'invalid',teams:[],verifiedUnits:false};
 const teams=[];
 for(const teamId of teamIds){
  const events=new Map(),seen=new Set();let rejected=0;
  for(const s of shifts){
   if(s?.teamId!==teamId)continue;
   if(!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>seconds||s.end<=s.start){rejected++;continue}
   const key=[s.playerId,s.start,s.end].join(':');if(seen.has(key)){rejected++;continue}seen.add(key);
   for(const [t,delta] of [[s.start,1],[s.end,-1]]){if(!events.has(t))events.set(t,[]);events.get(t).push([s.playerId,delta])}
  }
  const times=[0,...events.keys(),seconds].sort((a,b)=>a-b).filter((t,i,a)=>i===0||t!==a[i-1]);
  const active=new Map(),durations=new Map();let fiveSkaterSeconds=0;
  for(let i=0;i<times.length-1;i++){
   const t=times[i];
   for(const [id,delta] of events.get(t)||[]){const n=(active.get(id)||0)+delta;if(n<=0)active.delete(id);else active.set(id,n)}
   const dt=times[i+1]-t;
   if(active.size!==5||[...active.values()].some(n=>n!==1))continue;
   const ids=[...active.keys()].sort((a,b)=>a-b);const key=ids.join(',');
   durations.set(key,(durations.get(key)||0)+dt);fiveSkaterSeconds+=dt;
  }
  const combinations=[...durations].map(([key,seconds])=>({playerIds:key.split(',').map(Number),seconds})).sort((a,b)=>b.seconds-a.seconds||a.playerIds.join(',').localeCompare(b.playerIds.join(',')));
  teams.push({teamId,fiveSkaterSeconds,rejected,combinations});
 }
 return {status:'diagnostic-only',teams,verifiedUnits:false,warning:'Five skaters on ice does not prove even-strength 5v5 or a verified line.'};
}
module.exports={observedFiveSkaterCombinations};
