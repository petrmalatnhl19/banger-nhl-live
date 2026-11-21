'use strict';
// LINEUPS-03.60: independent NHL play-by-play event-point evidence for matching short gaps.
// Event points cannot certify the continuous strength between them.
const {auditRecoveryEventEvidence}=require('./lineups_03_44_recovery_event_evidence.cjs');
function auditMatchingShortGapEvents({identityAudit,plays}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(identityAudit?.status!=='candidate-only'||!Array.isArray(identityAudit.intervals)||!Array.isArray(plays))return fail('invalid-input');
 const matching=identityAudit.intervals.filter(w=>w.classification==='matchingBothTeams');
 const evidence=auditRecoveryEventEvidence({recoveryCandidates:matching,plays});
 if(evidence.status!=='candidate-only'||evidence.windows.length!==matching.length)return fail('event-evidence-failed');
 const totals={matchingIntervals:matching.length,interiorFiveOnFiveEventIntervals:0,conflictingEventIntervals:0,noInteriorEventIntervals:0,matchingWithBothSamePeriodNeighborsFiveOnFive:0};
 const details=evidence.windows.map((e,i)=>{
  const w=matching[i],period=Math.floor(w.startSecond/1200)+1;
  const samePeriodNeighbors=[e.precedingEvent,e.followingEvent].every(n=>n&&Math.floor(n.second/1200)+1===period&&n.strength==='5v5');
  if(e.conflictingEvents)totals.conflictingEventIntervals++;
  else if(e.pointSupport)totals.interiorFiveOnFiveEventIntervals++;
  else totals.noInteriorEventIntervals++;
  if(samePeriodNeighbors)totals.matchingWithBothSamePeriodNeighborsFiveOnFive++;
  return {startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,interiorFiveOnFiveEvents:e.pointSupport,conflictingEvents:e.conflictingEvents,bothSamePeriodNeighborsFiveOnFive:samePeriodNeighbors,verifiedStrength:false,publishable:false};
 });
 return {status:'candidate-only',...totals,details,verifiedStrength:false,publishable:false,note:'NHL play-by-play is independent point evidence; neither neighboring nor interior event codes prove uninterrupted 5v5.'};
}
module.exports={auditMatchingShortGapEvents};
