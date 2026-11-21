'use strict';
// LINEUPS-03.50: remove cross-period event adjacency after segment-level audit.
// Event points are not continuous-strength evidence.
function constrainSegmentEventNeighbors(segmentAudit,{periodSeconds=1200}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(segmentAudit?.status!=='candidate-only'||!Array.isArray(segmentAudit.segments)||!Number.isInteger(periodSeconds)||periodSeconds<=0)return fail('invalid-input');
 const segments=[];
 for(const s of segmentAudit.segments){
  if(!s||!Number.isInteger(s.period)||s.period<1||!Number.isInteger(s.startSecond)||!Number.isInteger(s.endSecondExclusive)||s.startSecond<0||s.endSecondExclusive<=s.startSecond||Math.floor(s.startSecond/periodSeconds)+1!==s.period||Math.floor((s.endSecondExclusive-1)/periodSeconds)+1!==s.period)return fail('invalid-segment');
  const periodStart=(s.period-1)*periodSeconds,periodEnd=s.period*periodSeconds;
  const precedingEvent=s.precedingEvent&&Number.isInteger(s.precedingEvent.second)&&s.precedingEvent.second>=periodStart&&s.precedingEvent.second<periodEnd?s.precedingEvent:null;
  const followingEvent=s.followingEvent&&Number.isInteger(s.followingEvent.second)&&s.followingEvent.second>=periodStart&&s.followingEvent.second<periodEnd?s.followingEvent:null;
  segments.push({...s,precedingEvent,followingEvent,crossPeriodNeighborDiscarded:Boolean(s.precedingEvent&&!precedingEvent||s.followingEvent&&!followingEvent),verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',segments,discardedCrossPeriodNeighborCount:segments.filter(s=>s.crossPeriodNeighborDiscarded).length,verifiedStrength:false,publishable:false,note:'Neighbor event points outside the segment period are excluded; interval strength remains unverified.'};
}
module.exports={constrainSegmentEventNeighbors};
