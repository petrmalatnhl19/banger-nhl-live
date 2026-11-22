'use strict';
// LINEUPS-03.45: triage recovery windows against adjacent NHL event strength.
// Adjacent point codes never establish continuous strength or exact transition time.
function triageRecoveryBoundaries(evidence){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false,windows:[]});
 if(evidence?.status!=='candidate-only'||!Array.isArray(evidence.windows))return fail('missing-evidence');
 const windows=[];
 for(const w of evidence.windows){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.endSecondExclusive<=w.startSecond||!Number.isInteger(w.conflictingEvents)||!Number.isInteger(w.pointSupport)||w.conflictingEvents<0||w.pointSupport<0)return fail('invalid-window');
  const before=w.precedingEvent,after=w.followingEvent;
  for(const e of [before,after])if(e!==null&&e!==undefined&&(!Number.isInteger(e.second)||typeof e.strength!=='string'))return fail('invalid-boundary-evidence');
  const transitionAdjacent=Boolean(before&&before.strength!=='5v5'||after&&after.strength!=='5v5');
  const classification=w.conflictingEvents?'conflicting-interior-event':transitionAdjacent?'boundary-transition-risk':w.pointSupport?'consistent-point-evidence-only':'insufficient-point-evidence';
  windows.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.endSecondExclusive-w.startSecond,classification,transitionAdjacent,pointSupport:w.pointSupport,conflictingEvents:w.conflictingEvents,requiresContinuousStrengthEvidence:true,verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',windows,counts:Object.fromEntries([...new Set(windows.map(w=>w.classification))].map(k=>[k,windows.filter(w=>w.classification===k).length])),verifiedStrength:false,publishable:false,note:'Event boundaries are point observations, not verified continuous-strength transitions.'};
}
module.exports={triageRecoveryBoundaries};
