'use strict';
// LINEUPS-03.55: complete uncovered interval inventory; no strength promotion.
function auditCompleteRecoveryInventory({classification,minSeconds=10}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.allIntervals)||!Number.isInteger(minSeconds)||minSeconds<1||!Number.isInteger(classification.uncoveredSeconds)||classification.uncoveredSeconds<0)return fail('invalid-input');
 const categories={fiveVsFiveCount:0,otherSkaterCounts:0,incompleteOrAmbiguous:0},seen=[],candidates=[];let total=0;
 for(const w of classification.allIntervals){
  if(!w||!Object.hasOwn(categories,w.category)||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.startSecond<0||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-interval');
  if(seen.length&&w.startSecond<seen.at(-1).endSecondExclusive)return fail('overlap-or-unsorted');
  seen.push(w);total+=w.seconds;categories[w.category]+=w.seconds;
  if(w.category==='fiveVsFiveCount'&&w.seconds>=minSeconds)candidates.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,reason:'shift-count-5v5-only',verifiedStrength:false,publishable:false});
 }
 if(total!==classification.uncoveredSeconds||Object.keys(categories).some(k=>categories[k]!==classification.categories?.[k]))return fail('coverage-mismatch');
 candidates.sort((a,b)=>b.seconds-a.seconds||a.startSecond-b.startSecond);
 return {status:'candidate-only',intervalCount:seen.length,uncoveredSeconds:total,categories,allFiveVsFiveCountSeconds:categories.fiveVsFiveCount,eligibleCandidateSeconds:candidates.reduce((n,w)=>n+w.seconds,0),belowMinimumSeconds:categories.fiveVsFiveCount-candidates.reduce((n,w)=>n+w.seconds,0),candidateCount:candidates.length,minSeconds,candidates,sourceTruncated:false,verifiedStrength:false,publishable:false,note:'Complete shift-count inventory, not independently verified 5v5; no production promotion.'};
}
module.exports={auditCompleteRecoveryInventory};
