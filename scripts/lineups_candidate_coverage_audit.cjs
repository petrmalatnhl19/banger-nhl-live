'use strict';
// LINEUPS-03.24: explicit evidence coverage, not a confirmation score.
// The denominator is the regulation duration, not the unknown actual PP time.
function auditCandidateCoverage(intervals,units,awayId,homeId){
 const fail={status:'unverified',teams:[],publishable:false,verifiedUnits:false};
 if(!Array.isArray(intervals)||units?.status!=='candidate-only'||!Array.isArray(units.teams)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return fail;
 let lastEnd=0;const byStrength=new Map();
 for(const w of intervals){
  if(!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<lastEnd||w.endSecondExclusive<=w.startSecond||w.endSecondExclusive>3600||!/^\d+v\d+$/.test(w.strength))return fail;
  lastEnd=w.endSecondExclusive;
  byStrength.set(w.strength,(byStrength.get(w.strength)||0)+w.endSecondExclusive-w.startSecond);
 }
 const teams=[];
 for(const id of [awayId,homeId]){
  const t=units.teams.find(x=>x.teamId===id);if(!t||!Array.isArray(t.units))return fail;
  const categories={PP:{candidateSeconds:0,topUnitSeconds:0,combinationCount:0},PK:{candidateSeconds:0,topUnitSeconds:0,combinationCount:0}};
  for(const [strength,seconds] of byStrength){
   const [a,h]=strength.split('v').map(Number),own=id===awayId?a:h,opp=id===awayId?h:a;
   if(own===6||opp===6||own===opp)continue;
   const type=own>opp?'PP':'PK';categories[type].candidateSeconds+=seconds;
  }
  for(const u of t.units){
   const [a,h]=String(u.strength).split('v').map(Number),own=id===awayId?a:h,opp=id===awayId?h:a;
   if(!Number.isInteger(own)||!Number.isInteger(opp)||!Number.isInteger(u.seconds)||u.seconds<1)return fail;
   if(own===6||opp===6||own===opp)continue;
   const type=own>opp?'PP':'PK';categories[type].combinationCount++;
   categories[type].topUnitSeconds=Math.max(categories[type].topUnitSeconds,u.seconds);
  }
  for(const type of ['PP','PK']){
   const c=categories[type];
   c.topUnitShareOfCandidateSeconds=c.candidateSeconds?Number((c.topUnitSeconds/c.candidateSeconds).toFixed(3)):null;
   c.totalSpecialTeamsSeconds='unknown';
   c.fullGameCoverage='unknown';
  }
  teams.push({teamId:id,...categories});
 }
 return {status:'candidate-only',teams,publishable:false,verifiedUnits:false,reason:'Candidate-time share is not actual PP/PK time coverage. Missing event gaps and goalie-state uncertainty prevent verified deployment.'};
}
module.exports={auditCandidateCoverage};
