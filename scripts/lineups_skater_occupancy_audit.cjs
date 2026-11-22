'use strict';
// LINEUPS-03.9: diagnostic on-ice occupancy, not verified game strength.
// Half-open intervals, all teams separately, never infer PP/PK from occupancy.
function summarizeSkaterOccupancy(shifts,teamIds,seconds=3600){
 if(!Array.isArray(shifts)||!Array.isArray(teamIds)||teamIds.length!==2||!teamIds.every(Number.isInteger)||!Number.isInteger(seconds)||seconds<=0)return {status:'invalid',teams:[]};
 const teams=[];
 for(const teamId of teamIds){
  const timeline=new Int16Array(seconds+1),seen=new Set(),invalid=[];
  for(const s of shifts){
   if(s.teamId!==teamId)continue;
   if(!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>seconds||s.end<=s.start){invalid.push('invalid-interval');continue}
   const key=s.playerId+':'+s.start+':'+s.end;
   if(seen.has(key)){invalid.push('duplicate-interval');continue}seen.add(key);
   timeline[s.start]++;timeline[s.end]--;
  }
  let count=0;const histogram={},overCapacity=[];
  for(let t=0;t<seconds;t++){count+=timeline[t];histogram[count]=(histogram[count]||0)+1;if(count>6)overCapacity.push(t)}
  teams.push({teamId,histogram,overCapacitySeconds:overCapacity.length,invalidShiftCount:invalid.length});
 }
 return {status:'diagnostic-only',teams,verifiedStrength:false};
}
module.exports={summarizeSkaterOccupancy};
