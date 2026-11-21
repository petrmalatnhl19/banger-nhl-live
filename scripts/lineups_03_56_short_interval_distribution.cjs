'use strict';
// LINEUPS-03.56: short-interval distribution; purely diagnostic.
function auditShortRecoveryIntervals({classification,thresholds=[1,3,5,10]}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.allIntervals)||!Number.isInteger(classification.categories?.fiveVsFiveCount)||!Array.isArray(thresholds)||!thresholds.length||thresholds.some(t=>!Number.isInteger(t)||t<1)||new Set(thresholds).size!==thresholds.length)return fail('invalid-input');
 const lengths=[];let sum=0;
 for(const w of classification.allIntervals){
  if(!w||!['fiveVsFiveCount','otherSkaterCounts','incompleteOrAmbiguous'].includes(w.category)||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.startSecond<0||w.endSecondExclusive>3600||w.seconds!==w.endSecondExclusive-w.startSecond||w.seconds<=0)return fail('invalid-interval');
  if(w.category==='fiveVsFiveCount'){lengths.push(w.seconds);sum+=w.seconds;}
 }
 if(sum!==classification.categories.fiveVsFiveCount)return fail('coverage-mismatch');
 const bands=[{label:'1-2s',min:1,max:2},{label:'3-4s',min:3,max:4},{label:'5-9s',min:5,max:9},{label:'10s+',min:10,max:Infinity}].map(b=>({label:b.label,intervalCount:lengths.filter(n=>n>=b.min&&n<=b.max).length,seconds:lengths.filter(n=>n>=b.min&&n<=b.max).reduce((a,n)=>a+n,0)}));
 const thresholdSummary=thresholds.slice().sort((a,b)=>a-b).map(minSeconds=>({minSeconds,intervalCount:lengths.filter(n=>n>=minSeconds).length,candidateSeconds:lengths.filter(n=>n>=minSeconds).reduce((a,n)=>a+n,0)}));
 return {status:'candidate-only',fiveVsFiveCountSeconds:sum,intervalCount:lengths.length,bands,thresholdSummary,verifiedStrength:false,publishable:false,note:'Threshold analysis measures shift-count-only intervals; no continuous 5v5 verification.'};
}
module.exports={auditShortRecoveryIntervals};
