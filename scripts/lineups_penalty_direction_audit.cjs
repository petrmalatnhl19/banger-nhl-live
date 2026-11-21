'use strict';
// LINEUPS-03.29: penalty-direction audit, never a PP-clock reconstruction.
// Only count candidate strength windows that start after a penalty and within
// the nominal two-minute window; do not equate these with verified PP seconds.
function auditPenaltyDirection(penaltyEvidence,awayId,homeId){
 const empty={status:'unverified',penalties:[],verifiedStrengthWindows:false,publishable:false};
 if(penaltyEvidence?.status!=='penalty-context-only'||!Array.isArray(penaltyEvidence.penalties)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const penalties=penaltyEvidence.penalties.map(p=>{
  const team=p.teamId,validTeam=team===awayId||team===homeId;
  const expected=team===awayId?'away-shorthanded':team===homeId?'home-shorthanded':null;
  const windowEnd=p.second+(p.minutes===2?120:0);
  const nearby=(p.nearbyCandidateWindows||[]).filter(w=>Number.isInteger(w.startSecond)&&Number.isInteger(w.seconds)&&w.seconds>0&&w.startSecond>=p.second&&w.startSecond<windowEnd);
  let matchingSeconds=0,opposingSeconds=0;
  for(const w of nearby){
   const m=/^(\d+)v(\d+)$/.exec(w.strength||'');if(!m)continue;
   const a=Number(m[1]),h=Number(m[2]);if(a===6||h===6||a===h)continue;
   const correct=team===awayId?a<h:team===homeId?h<a:false;
   if(correct)matchingSeconds+=Math.min(w.seconds,windowEnd-w.startSecond);
   else opposingSeconds+=Math.min(w.seconds,windowEnd-w.startSecond);
  }
  return {eventId:p.eventId,second:p.second,teamId:team,expectedDirection:validTeam&&p.minutes===2?expected:'unknown',matchingCandidateSeconds:matchingSeconds,opposingCandidateSeconds:opposingSeconds,assessment:validTeam&&p.minutes===2&&matchingSeconds>0&&opposingSeconds===0?'direction-supported':'needs-review',verified:false};
 });
 return {status:'candidate-direction-audit',penalties,verifiedStrengthWindows:false,publishable:false,reason:'Candidate intervals are sparse; proximity and direction are not continuous official PP clock evidence.'};
}
module.exports={auditPenaltyDirection};
