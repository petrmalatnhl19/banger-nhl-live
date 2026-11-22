'use strict';
// LINEUPS-03.57: compare short 5v5-count gap boundaries to shift start/end timestamps.
// Coincidence with shift timestamps does not prove rounding or genuine game state.
function auditShortGapShiftBoundaries({classification,shifts,maxSeconds=2,proximitySeconds=1}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.allIntervals)||!Array.isArray(shifts)||!Number.isInteger(maxSeconds)||maxSeconds<1||!Number.isInteger(proximitySeconds)||proximitySeconds<0)return fail('invalid-input');
 const starts=new Set(),ends=new Set();
 for(const s of shifts){
  if(!s||!Number.isInteger(s.teamId)||!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start)return fail('invalid-shift');
  starts.add(s.start);ends.add(s.end);
 }
 const nearest=(t,set)=>{let min=Infinity;for(const v of set){const d=Math.abs(t-v);if(d<min)min=d;}return Number.isFinite(min)?min:null;};
 const intervals=[];
 for(const w of classification.allIntervals){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.startSecond<0||w.endSecondExclusive>3600||w.seconds!==w.endSecondExclusive-w.startSecond||w.seconds<=0)return fail('invalid-interval');
  if(w.category!=='fiveVsFiveCount'||w.seconds>maxSeconds)continue;
  const startDistance=Math.min(nearest(w.startSecond,starts)??Infinity,nearest(w.startSecond,ends)??Infinity);
  const endDistance=Math.min(nearest(w.endSecondExclusive,starts)??Infinity,nearest(w.endSecondExclusive,ends)??Infinity);
  intervals.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,startBoundaryDistanceSeconds:Number.isFinite(startDistance)?startDistance:null,endBoundaryDistanceSeconds:Number.isFinite(endDistance)?endDistance:null,bothBoundariesNearShiftChanges:startDistance<=proximitySeconds&&endDistance<=proximitySeconds,verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',maxSeconds,proximitySeconds,shortIntervalCount:intervals.length,shortIntervalSeconds:intervals.reduce((n,w)=>n+w.seconds,0),bothBoundariesNearCount:intervals.filter(w=>w.bothBoundariesNearShiftChanges).length,exactBothBoundariesCount:intervals.filter(w=>w.startBoundaryDistanceSeconds===0&&w.endBoundaryDistanceSeconds===0).length,intervals,verifiedStrength:false,publishable:false,note:'Shift boundary proximity is descriptive; it cannot identify NHL clock rounding as the cause.'};
}
module.exports={auditShortGapShiftBoundaries};
