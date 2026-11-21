'use strict';
// LINEUPS-03.52: conservative recovery readiness; identity completeness is not strength proof.
function assessRecoveryReadiness({identityAudit,eventAudit}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],publishable:false,verifiedStrength:false});
 if(identityAudit?.status!=='candidate-only'||eventAudit?.status!=='candidate-only'||!Array.isArray(identityAudit.segments)||!Array.isArray(eventAudit.segments)||identityAudit.segments.length!==eventAudit.segments.length)return fail('invalid-input');
 const segments=[];
 for(let i=0;i<identityAudit.segments.length;i++){
  const a=identityAudit.segments[i],e=eventAudit.segments[i];
  if(!a||!e||a.startSecond!==e.startSecond||a.endSecondExclusive!==e.endSecondExclusive||!Number.isInteger(a.seconds)||a.seconds!==a.endSecondExclusive-a.startSecond||!Number.isInteger(a.completeIdentitySeconds)||!Number.isInteger(a.ambiguousIdentitySeconds)||a.completeIdentitySeconds+a.ambiguousIdentitySeconds!==a.seconds)return fail('mismatched-evidence');
  const identityComplete=a.ambiguousIdentitySeconds===0;
  const hasPointSupport=Number.isInteger(e.pointSupport)&&e.pointSupport>0&&e.conflictingEvents===0;
  const boundaryRisk=e.classification==='boundary-transition-risk'||e.classification==='period-split-requires-revalidation';
  segments.push({startSecond:a.startSecond,endSecondExclusive:a.endSecondExclusive,seconds:a.seconds,identityComplete,hasPointSupport,boundaryRisk,missingIndependentContinuousStrength:true,readiness:!identityComplete?'identity-incomplete':!hasPointSupport?'point-evidence-insufficient':boundaryRisk?'boundary-review-required':'independent-strength-required',verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',segments,identityCompleteSeconds:segments.filter(x=>x.identityComplete).reduce((n,x)=>n+x.seconds,0),independentlyVerifiedSeconds:0,verifiedStrength:false,publishable:false,note:'No candidate may be promoted from shiftchart identities or isolated event points alone.'};
}
module.exports={assessRecoveryReadiness};
