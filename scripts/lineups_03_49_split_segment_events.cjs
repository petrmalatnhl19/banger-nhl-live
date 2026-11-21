'use strict';
// LINEUPS-03.49: re-evaluate NHL event points separately after period split.
const {auditRecoveryEventEvidence}=require('./lineups_03_44_recovery_event_evidence.cjs');
function auditSplitSegmentEvents({periodSegments,plays}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(periodSegments?.status!=='candidate-only'||!Array.isArray(periodSegments.segments)||!Array.isArray(plays))return fail('missing-evidence');
 const windows=periodSegments.segments.map(s=>({startSecond:s.startSecond,endSecondExclusive:s.endSecondExclusive}));
 const evidence=auditRecoveryEventEvidence({recoveryCandidates:windows,plays});
 if(evidence.status!=='candidate-only'||evidence.windows.length!==windows.length)return fail('event-audit-failed');
 const segments=periodSegments.segments.map((s,i)=>{
  const e=evidence.windows[i];
  return {startSecond:s.startSecond,endSecondExclusive:s.endSecondExclusive,seconds:s.seconds,period:s.period,sourceClassification:s.sourceClassification,classification:s.classification,eventCount:e.eventCount,pointSupport:e.pointSupport,conflictingEvents:e.conflictingEvents,eventStatus:e.status,precedingEvent:e.precedingEvent,followingEvent:e.followingEvent,requiresContinuousStrengthEvidence:true,verifiedStrength:false,publishable:false};
 });
 return {status:'candidate-only',segments,splitWithoutEventCount:segments.filter(s=>s.classification==='period-split-requires-revalidation'&&s.eventCount===0).length,verifiedStrength:false,publishable:false,note:'Event points are reassessed per split segment; evidence is never inherited from parent windows.'};
}
module.exports={auditSplitSegmentEvents};
