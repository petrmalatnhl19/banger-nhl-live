'use strict';
// LINEUPS-03.58: inspect whether short uncovered 5v5-count intervals touch covered 5v5 candidate windows.
function auditShortGapCoverageNeighbors({classification,coverage,maxSeconds=2}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(classification?.status!=='candidate-only'||!Array.isArray(classification.allIntervals)||coverage?.status!=='candidate-only'||!Array.isArray(coverage.gaps)||!Number.isInteger(maxSeconds)||maxSeconds<1)return fail('invalid-input');
 const gaps=coverage.gaps.slice().sort((a,b)=>a.startSecond-b.startSecond);
 for(let i=0;i<gaps.length;i++){const g=gaps[i];if(!Number.isInteger(g.startSecond)||!Number.isInteger(g.endSecondExclusive)||g.startSecond<0||g.endSecondExclusive>3600||g.endSecondExclusive<=g.startSecond||g.seconds!==g.endSecondExclusive-g.startSecond||(i&&g.startSecond<gaps[i-1].endSecondExclusive))return fail('invalid-coverage-gaps');}
 let both=0,one=0,neither=0;const intervals=[];
 for(const w of classification.allIntervals){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||!Number.isInteger(w.seconds)||w.seconds<=0||w.seconds!==w.endSecondExclusive-w.startSecond)return fail('invalid-interval');
  if(w.category!=='fiveVsFiveCount'||w.seconds>maxSeconds)continue;
  const g=gaps.find(g=>g.startSecond<=w.startSecond&&w.endSecondExclusive<=g.endSecondExclusive);
  if(!g)return fail('interval-outside-uncovered-gap');
  const leftCovered=g.startSecond===w.startSecond&&g.startSecond>0;
  const rightCovered=g.endSecondExclusive===w.endSecondExclusive&&g.endSecondExclusive<3600;
  const kind=leftCovered&&rightCovered?'both':leftCovered||rightCovered?'one':'neither';
  if(kind==='both')both++;else if(kind==='one')one++;else neither++;
  intervals.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.seconds,adjacentCoveredSides:kind});
 }
 return {status:'candidate-only',shortIntervalCount:intervals.length,bothCoveredSides:both,oneCoveredSide:one,noCoveredSides:neither,intervals,verifiedStrength:false,publishable:false,note:'Adjacency to existing candidate 5v5 coverage does not establish strength or explain source timing.'};
}
module.exports={auditShortGapCoverageNeighbors};
