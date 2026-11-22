'use strict';
// LINEUPS-03.32: distinguish overlap between different penalties from
// repeated candidate windows within the same penalty. No official PP clock.
function auditPenaltyOverlapProvenance(evidence,awayId,homeId){
 const empty={status:'unverified',distinctPenaltyOverlapSeconds:0,repeatedWindowSeconds:0,uniqueSeconds:0,verified:false,publishable:false};
 if(evidence?.status!=='penalty-context-only'||!Array.isArray(evidence.penalties)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const owners=new Map(),samePenaltyDuplicates=new Set(),crossPenaltyDuplicates=new Set();
 for(let i=0;i<evidence.penalties.length;i++){
  const p=evidence.penalties[i];
  if(![awayId,homeId].includes(p.teamId)||p.minutes!==2||!Number.isInteger(p.second)||p.second<0||p.second>=3600)continue;
  const local=new Set();
  for(const w of p.nearbyCandidateWindows||[]){
   const m=/^(\d+)v(\d+)$/.exec(w.strength||'');
   if(!m||!Number.isInteger(w.startSecond)||!Number.isInteger(w.seconds)||w.seconds<1)continue;
   const a=Number(m[1]),h=Number(m[2]);if(a===h||a>5||h>5||a<3||h<3)continue;
   const advantaged=a>h?awayId:homeId;if(advantaged===p.teamId)continue;
   const start=Math.max(w.startSecond,p.second),end=Math.min(w.startSecond+w.seconds,p.second+120,3600);
   for(let t=start;t<end;t++){
    const key=t+':'+advantaged;
    if(local.has(key)){samePenaltyDuplicates.add(key);continue}
    local.add(key);
    if(owners.has(key)&&owners.get(key)!==i)crossPenaltyDuplicates.add(key);
    else if(!owners.has(key))owners.set(key,i);
   }
  }
 }
 return {status:'candidate-overlap-provenance',distinctPenaltyOverlapSeconds:crossPenaltyDuplicates.size,repeatedWindowSeconds:samePenaltyDuplicates.size,uniqueSeconds:owners.size,verified:false,publishable:false,reason:'Overlap describes candidate evidence reuse, not an independently verified PP clock.'};
}
module.exports={auditPenaltyOverlapProvenance};
