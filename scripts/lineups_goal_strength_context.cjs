'use strict';
// LINEUPS-03.35: compare candidate strength at goal seconds to penalty flags.
// Candidate-only: goal event boundaries and missing shifts prevent confirmation.
function auditGoalStrengthContext(goalPenaltyInteractions,windows,awayId,homeId){
 const empty={status:'unverified',goals:[],verified:false,publishable:false};
 if(goalPenaltyInteractions?.status!=='goal-penalty-context'||!Array.isArray(windows)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const goals=goalPenaltyInteractions.interactions.map(g=>{
  const hits=windows.filter(w=>Number.isInteger(w.startSecond)&&Number.isInteger(w.endSecondExclusive)&&w.startSecond<=g.goalSecond&&g.goalSecond<w.endSecondExclusive&&/^\d+v\d+$/.test(w.strength||''));
  const strengths=[...new Set(hits.map(w=>w.strength))];
  const candidatePowerPlay=strengths.some(s=>{
   const [a,h]=s.split('v').map(Number);
   return a>=3&&h>=3&&a<=5&&h<=5&&(g.scoringTeamId===awayId?a>h:h>a);
  });
  return {goalEventId:g.goalEventId,penaltyEventId:g.penaltyEventId,goalSecond:g.goalSecond,candidateStrengths:strengths,candidatePowerPlay,assessment:strengths.length===0?'missing-candidate-at-goal':strengths.length>1?'conflicting-candidates':candidatePowerPlay?'power-play-candidate':'no-power-play-candidate',verified:false};
 });
 return {status:'goal-strength-candidate-context',goals,verified:false,publishable:false,reason:'Shift-based strength at event boundaries is candidate-only; no penalty termination is inferred.'};
}
module.exports={auditGoalStrengthContext};
