'use strict';
// LINEUPS-03.30: avoid double-counting the same observed candidate second
// across overlapping penalty contexts. This is not official PP time.
function auditUniquePenaltyCandidateSeconds(penaltyEvidence,awayId,homeId){
 const empty={status:'unverified',uniqueCandidateSeconds:0,byAdvantagedTeam:[],overlappingSeconds:0,verifiedStrengthWindows:false,publishable:false};
 if(penaltyEvidence?.status!=='penalty-context-only'||!Array.isArray(penaltyEvidence.penalties)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const seen=new Map();let counted=0,duplicates=0;
 for(const p of penaltyEvidence.penalties){
  if(![awayId,homeId].includes(p.teamId)||p.minutes!==2||!Number.isInteger(p.second))continue;
  const end=p.second+120;
  for(const w of p.nearbyCandidateWindows||[]){
   const match=/^(\d+)v(\d+)$/.exec(w.strength||'');
   if(!match||!Number.isInteger(w.startSecond)||!Number.isInteger(w.seconds)||w.seconds<1)continue;
   const a=Number(match[1]),h=Number(match[2]);
   if(a===6||h===6||a===h)continue;
   const advantaged=a>h?awayId:homeId;
   if(advantaged===p.teamId)continue;
   for(let t=Math.max(w.startSecond,p.second);t<Math.min(w.startSecond+w.seconds,end);t++){
    const key=t+':'+advantaged;
    if(seen.has(key)){duplicates++;continue}
    seen.set(key,advantaged);counted++;
   }
  }
 }
 const byAdvantagedTeam=[awayId,homeId].map(teamId=>({teamId,uniqueCandidateSeconds:[...seen.values()].filter(v=>v===teamId).length}));
 return {status:'candidate-unique-seconds',uniqueCandidateSeconds:counted,byAdvantagedTeam,overlappingSeconds:duplicates,verifiedStrengthWindows:false,publishable:false,reason:'Deduplicated observed candidate seconds, not complete or independently verified penalty-clock time.'};
}
module.exports={auditUniquePenaltyCandidateSeconds};
