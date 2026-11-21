'use strict';
// LINEUPS-03.33: identify candidate special-teams seconds that are not covered
// by a same-direction nominal two-minute penalty context.
// Not proof of an error: majors, coincidentals, delayed calls and event gaps.
function auditUnattributedSpecialTeamsCandidates(windows,penaltyEvidence,awayId,homeId){
 const empty={status:'unverified',byTeam:[],verified:false,publishable:false};
 if(!Array.isArray(windows)||penaltyEvidence?.status!=='penalty-context-only'||!Array.isArray(penaltyEvidence.penalties)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const candidate=new Map(),attributed=new Set();
 for(const w of windows){
  const m=/^(\d+)v(\d+)$/.exec(w?.strength||'');
  if(!m||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond)continue;
  const a=Number(m[1]),h=Number(m[2]);if(a<3||h<3||a>5||h>5||a===h)continue;
  const advantaged=a>h?awayId:homeId;
  for(let t=w.startSecond;t<w.endSecondExclusive;t++)candidate.set(t+':'+advantaged,{teamId:advantaged,second:t});
 }
 for(const p of penaltyEvidence.penalties){
  if(![awayId,homeId].includes(p.teamId)||p.minutes!==2||!Number.isInteger(p.second)||p.second<0||p.second>=3600)continue;
  const advantaged=p.teamId===awayId?homeId:awayId;
  for(let t=p.second;t<Math.min(3600,p.second+120);t++){
   const key=t+':'+advantaged;if(candidate.has(key))attributed.add(key);
  }
 }
 const byTeam=[awayId,homeId].map(teamId=>{
  const seconds=[...candidate.values()].filter(v=>v.teamId===teamId);
  const uncovered=seconds.filter(v=>!attributed.has(v.second+':'+teamId));
  return {teamId,candidateSeconds:seconds.length,withinMinorPenaltyContextSeconds:seconds.length-uncovered.length,unattributedCandidateSeconds:uncovered.length};
 });
 return {status:'candidate-coverage-gaps',byTeam,verified:false,publishable:false,reason:'Unattributed candidate seconds require investigation, not automatic rejection or publication.'};
}
module.exports={auditUnattributedSpecialTeamsCandidates};
