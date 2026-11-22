'use strict';
// LINEUPS-03.21: aggregate exact skater combinations inside candidate strength intervals.
// Candidate-only; shiftchart player IDs are not independently verified PP/PK units.
function candidateStrengthUnits(shifts,intervals,awayId,homeId){
 const base={status:'unverified',teams:[],verifiedUnits:false};
 if(!Array.isArray(shifts)||!Array.isArray(intervals)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return base;
 const teamIds=[awayId,homeId],relevant=shifts.filter(s=>s&&teamIds.includes(s.teamId));
 if(relevant.some(s=>!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start))return base;
 const seen=new Set();
 for(const s of relevant){const k=[s.teamId,s.playerId,s.start,s.end].join(':');if(seen.has(k))return base;seen.add(k)}
 const totals=new Map(teamIds.map(id=>[id,new Map()])),durations=new Map(teamIds.map(id=>[id,0]));
 let previousEnd=0;
 for(const w of intervals){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<previousEnd||w.endSecondExclusive<=w.startSecond||w.endSecondExclusive>3600||!/^\d+v\d+$/.test(w.strength))return base;
  previousEnd=w.endSecondExclusive;
  const expected=w.strength.split('v').map(Number);
  if(expected.some(n=>n<3||n>6))return base;
  for(let t=w.startSecond;t<w.endSecondExclusive;t++){
   for(let i=0;i<2;i++){
    const id=teamIds[i],active=relevant.filter(s=>s.teamId===id&&s.start<=t&&t<s.end),ids=[...new Set(active.map(s=>s.playerId))].sort((a,b)=>a-b);
    if(ids.length!==expected[i]||active.length!==ids.length)return base;
    const key=w.strength+'|'+ids.join(','),m=totals.get(id);
    m.set(key,(m.get(key)||0)+1);durations.set(id,durations.get(id)+1);
   }
  }
 }
 return {status:'candidate-only',teams:teamIds.map(teamId=>({teamId,seconds:durations.get(teamId),units:[...totals.get(teamId)].map(([key,seconds])=>{const [strength,ids]=key.split('|');return {strength,playerIds:ids.split(',').map(Number),seconds}}).sort((a,b)=>b.seconds-a.seconds||a.strength.localeCompare(b.strength)||a.playerIds.join(',').localeCompare(b.playerIds.join(',')))})),verifiedUnits:false,reason:'Exact overlapping skaters inside candidate intervals; no independent confirmation of PP/PK deployment.'};
}
module.exports={candidateStrengthUnits};
