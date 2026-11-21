'use strict';
// LINEUPS-03.41: audit candidate 5v5 time coverage; uncovered != missing 5v5.
function auditFiveOnFiveCoverage({intervals,teams,regulationSeconds=3600}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(!Array.isArray(intervals)||!Array.isArray(teams)||teams.length!==2||!Number.isInteger(regulationSeconds)||regulationSeconds<=0)return fail('invalid-input');
 const ordered=intervals.filter(w=>w?.strength==='5v5').slice().sort((a,b)=>a.startSecond-b.startSecond);
 let prev=0,covered=0;const gaps=[];
 for(const w of ordered){
  if(!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<prev||w.endSecondExclusive>regulationSeconds||w.endSecondExclusive<=w.startSecond)return fail('invalid-or-overlapping-intervals');
  if(w.startSecond>prev)gaps.push({startSecond:prev,endSecondExclusive:w.startSecond,seconds:w.startSecond-prev});
  covered+=w.endSecondExclusive-w.startSecond;prev=w.endSecondExclusive;
 }
 if(prev<regulationSeconds)gaps.push({startSecond:prev,endSecondExclusive:regulationSeconds,seconds:regulationSeconds-prev});
 const seen=new Set(),summary=[];
 for(const t of teams){
  if(!Number.isInteger(t.teamId)||seen.has(t.teamId)||!Number.isInteger(t.candidateSeconds)||!Number.isInteger(t.skippedNonstandardSeconds)||t.candidateSeconds<0||t.skippedNonstandardSeconds<0||t.candidateSeconds+t.skippedNonstandardSeconds!==covered)return fail('team-seconds-inconsistent');
  seen.add(t.teamId);
  summary.push({teamId:t.teamId,standardSeconds:t.candidateSeconds,nonstandardSeconds:t.skippedNonstandardSeconds,candidateFiveOnFiveSeconds:covered});
 }
 return {status:'candidate-only',regulationSeconds,candidateFiveOnFiveSeconds:covered,unclassifiedRegulationSeconds:regulationSeconds-covered,gapCount:gaps.length,gaps:gaps.sort((a,b)=>b.seconds-a.seconds||a.startSecond-b.startSecond),teams:summary,verifiedStrength:false,publishable:false,note:'Unclassified seconds include non-5v5 play and intervals without sufficient evidence; they are not automatically missing 5v5.'};
}
module.exports={auditFiveOnFiveCoverage};
