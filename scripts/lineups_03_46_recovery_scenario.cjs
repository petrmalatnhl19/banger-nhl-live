'use strict';
// LINEUPS-03.46: hypothetical coverage only. No promotion into real lineups.
function simulateRecoveryCoverage({triage,baselineSeconds,regulationSeconds=3600}={}){
 const fail=reason=>({status:'unverified',reason,publishable:false,verifiedStrength:false});
 if(triage?.status!=='candidate-only'||!Array.isArray(triage.windows)||!Number.isInteger(baselineSeconds)||!Number.isInteger(regulationSeconds)||baselineSeconds<0||regulationSeconds<=0||baselineSeconds>regulationSeconds)return fail('invalid-input');
 let optimisticSeconds=0,transitionRiskSeconds=0;const seen=[];
 for(const w of triage.windows){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>regulationSeconds||w.endSecondExclusive<=w.startSecond||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-window');
  if(seen.some(x=>w.startSecond<x.endSecondExclusive&&w.endSecondExclusive>x.startSecond))return fail('overlapping-windows');
  seen.push(w);
  if(w.classification==='consistent-point-evidence-only')optimisticSeconds+=w.seconds;
  else if(w.classification==='boundary-transition-risk')transitionRiskSeconds+=w.seconds;
 }
 if(baselineSeconds+optimisticSeconds+transitionRiskSeconds>regulationSeconds)return fail('coverage-exceeds-regulation');
 return {status:'hypothetical-only',baselineSeconds,consistentPointEvidenceSeconds:optimisticSeconds,boundaryTransitionRiskSeconds:transitionRiskSeconds,possibleCoverageIfConfirmed:baselineSeconds+optimisticSeconds,possibleCoverageIncludingRiskIfConfirmed:baselineSeconds+optimisticSeconds+transitionRiskSeconds,verifiedStrength:false,publishable:false,note:'Counterfactual scenario, not a measured improvement; recovery windows require independent continuous-strength verification.'};
}
module.exports={simulateRecoveryCoverage};
