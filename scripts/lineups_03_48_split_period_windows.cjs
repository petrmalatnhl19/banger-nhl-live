'use strict';
// LINEUPS-03.48: split candidate gaps at period boundaries; never infer continuous play.
function splitRecoveryPeriodWindows({audit,periodSeconds=1200,regulationSeconds=3600}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(audit?.status!=='candidate-only'||!Array.isArray(audit.windows)||!Number.isInteger(periodSeconds)||periodSeconds<=0||!Number.isInteger(regulationSeconds)||regulationSeconds<=0||regulationSeconds%periodSeconds!==0)return fail('invalid-input');
 const segments=[];
 for(const w of audit.windows){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>regulationSeconds||w.endSecondExclusive<=w.startSecond||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-window');
  for(let start=w.startSecond;start<w.endSecondExclusive;){
   const end=Math.min(w.endSecondExclusive,(Math.floor(start/periodSeconds)+1)*periodSeconds);
   segments.push({startSecond:start,endSecondExclusive:end,seconds:end-start,period:Math.floor(start/periodSeconds)+1,sourceStartSecond:w.startSecond,sourceEndSecondExclusive:w.endSecondExclusive,sourceClassification:w.classification,classification:w.crossesPeriod?'period-split-requires-revalidation':w.classification,requiresContinuousStrengthEvidence:true,verifiedStrength:false,publishable:false});
   start=end;
  }
 }
 const totalSeconds=segments.reduce((n,x)=>n+x.seconds,0);
 const sourceSeconds=audit.windows.reduce((n,x)=>n+x.seconds,0);
 if(totalSeconds!==sourceSeconds)return fail('conservation-failed');
 return {status:'candidate-only',segments,totalSeconds,sourceSeconds,splitSegmentCount:segments.filter(s=>s.classification==='period-split-requires-revalidation').length,verifiedStrength:false,publishable:false,note:'Splitting removes cross-period continuity assumption but does not independently verify either segment.'};
}
module.exports={splitRecoveryPeriodWindows};
