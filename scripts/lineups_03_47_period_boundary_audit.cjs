'use strict';
// LINEUPS-03.47: prevent candidate recovery across regulation period boundaries.
function auditRecoveryPeriodBoundaries({triage,periodSeconds=1200,regulationSeconds=3600}={}){
 const fail=reason=>({status:'unverified',reason,windows:[],publishable:false,verifiedStrength:false});
 if(triage?.status!=='candidate-only'||!Array.isArray(triage.windows)||!Number.isInteger(periodSeconds)||periodSeconds<1||!Number.isInteger(regulationSeconds)||regulationSeconds<periodSeconds)return fail('invalid-input');
 const windows=[];
 for(const w of triage.windows){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>regulationSeconds||w.endSecondExclusive<=w.startSecond||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-window');
  const startPeriod=Math.floor(w.startSecond/periodSeconds)+1;
  const endPeriod=Math.floor((w.endSecondExclusive-1)/periodSeconds)+1;
  const crossesPeriod=startPeriod!==endPeriod;
  windows.push({...w,startPeriod,endPeriod,crossesPeriod,classification:crossesPeriod?'period-boundary-risk':w.classification,verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',windows,periodCrossingCount:windows.filter(w=>w.crossesPeriod).length,periodCrossingSeconds:windows.filter(w=>w.crossesPeriod).reduce((n,w)=>n+w.seconds,0),verifiedStrength:false,publishable:false,note:'Period-crossing gaps must be split at 1200-second boundaries and validated per period before any hypothetical recovery.'};
}
module.exports={auditRecoveryPeriodBoundaries};
