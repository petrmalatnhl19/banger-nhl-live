'use strict';
// LINEUPS-03.59: compare skater IDs immediately before/after short uncovered 5v5-count gaps.
// Identical skaters are not independent evidence of continuous 5v5 strength.
function auditShortGapIdentityContinuity({classification,coverage,shifts,awayId,homeId,maxSeconds=2}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.allIntervals)||coverage?.status!=='candidate-only'||!Array.isArray(coverage.gaps)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId||!Number.isInteger(maxSeconds)||maxSeconds<1)return fail('invalid-input');
 const gaps=coverage.gaps.slice().sort((a,b)=>a.startSecond-b.startSecond);
 for(let i=0;i<gaps.length;i++){const g=gaps[i];if(!Number.isInteger(g.startSecond)||!Number.isInteger(g.endSecondExclusive)||g.startSecond<0||g.endSecondExclusive>3600||g.endSecondExclusive<=g.startSecond||(i&&g.startSecond<gaps[i-1].endSecondExclusive))return fail('invalid-gaps');}
 for(const s of shifts)if(!s||![awayId,homeId].includes(s.teamId)||!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start)return fail('invalid-shift');
 const lineup=(t,teamId)=>{const rows=shifts.filter(s=>s.teamId===teamId&&s.start<=t&&t<s.end).map(s=>s.playerId);return rows.length===5&&new Set(rows).size===5?rows.sort((a,b)=>a-b).join(','):null;};
 const summary={matchingBothTeams:0,changedAtLeastOneTeam:0,unavailableIdentity:0,notBothSidesCovered:0};const intervals=[];
 for(const w of classification.allIntervals){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.seconds<=0||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-interval');
  if(w.category!=='fiveVsFiveCount'||w.seconds>maxSeconds)continue;
  const g=gaps.find(g=>g.startSecond<=w.startSecond&&w.endSecondExclusive<=g.endSecondExclusive);
  if(!g)return fail('interval-outside-gap');
  let result='notBothSidesCovered';
  if(w.startSecond===g.startSecond&&w.endSecondExclusive===g.endSecondExclusive&&w.startSecond>0&&w.endSecondExclusive<3600){
   const before=[lineup(w.startSecond-1,awayId),lineup(w.startSecond-1,homeId)];
   const after=[lineup(w.endSecondExclusive,awayId),lineup(w.endSecondExclusive,homeId)];
   result=[...before,...after].some(v=>v===null)?'unavailableIdentity':before.every((v,i)=>v===after[i])?'matchingBothTeams':'changedAtLeastOneTeam';
  }
  summary[result]++;intervals.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,classification:result});
 }
 return {status:'candidate-only',shortIntervalCount:intervals.length,...summary,intervals,verifiedStrength:false,publishable:false,note:'Comparison uses shift-derived identities at adjacent seconds, not independently verified continuous strength.'};
}
module.exports={auditShortGapIdentityContinuity};
