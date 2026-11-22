'use strict';
// LINEUPS-03.43: identify possible recoverable 5v5 gaps; never auto-promote to verified.
function auditRecoveryCandidates({classification,minSeconds=10}={}){
 const fail=reason=>({status:'unverified',reason,publishable:false,verifiedStrength:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.topIntervals)||!Number.isInteger(minSeconds)||minSeconds<1)return fail('invalid-evidence');
 const items=[];
 for(const w of classification.topIntervals){
  if(!w||!['fiveVsFiveCount','otherSkaterCounts','incompleteOrAmbiguous'].includes(w.category)||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.startSecond<0||w.endSecondExclusive<=w.startSecond||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-interval');
  if(w.category==='fiveVsFiveCount'&&w.seconds>=minSeconds)items.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,reason:'shift-count-5v5-only',requiresEventStrengthValidation:true});
 }
 items.sort((a,b)=>b.seconds-a.seconds||a.startSecond-b.startSecond);
 return {status:'candidate-only',recoveryCandidates:items,listedCandidateSeconds:items.reduce((n,x)=>n+x.seconds,0),sourceTruncated:true,verifiedStrength:false,publishable:false,note:'Classification contains only top intervals, so this is a prioritized sample, not a complete recoverable-time estimate.'};
}
module.exports={auditRecoveryCandidates};
