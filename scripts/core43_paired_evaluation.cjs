/* Honest paired evaluation: compare only predictions frozen before kickoff.
 * No database writes and no synthetic historical predictions.
 */
"use strict";
const valid=x=>typeof x==="number"&&Number.isFinite(x);
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
function pairedMetrics(rows,{baseline="core41",challenger="core43"}={}){
 const validRows=[],reasons={};
 for(const row of rows||[]){
  const fail=reason=>{reasons[reason]=(reasons[reason]||0)+1;};
  const a=row?.[baseline],b=row?.[challenger],actual=row?.actual;
  if(!a||!b||!actual){fail("missing_paired_prediction_or_actual");continue;}
  const kickoff=time(row.kickoffAt),ta=time(a.predictedAt),tb=time(b.predictedAt);
  if(![kickoff,ta,tb].every(Number.isFinite)||ta>=kickoff||tb>=kickoff){fail("invalid_prediction_timing");continue;}
  if(![a.away,a.home,b.away,b.home,actual.away,actual.home].every(valid)){fail("invalid_goals");continue;}
  if([a.away,a.home,b.away,b.home,actual.away,actual.home].some(x=>x<0||x>20)){fail("goals_out_of_range");continue;}
  const abs=m=>(Math.abs(m.away-actual.away)+Math.abs(m.home-actual.home))/2;
  const sq=m=>((m.away-actual.away)**2+(m.home-actual.home)**2)/2;
  validRows.push({gameId:row.gameId,baselineAbs:abs(a),challengerAbs:abs(b),baselineSq:sq(a),challengerSq:sq(b)});
 }
 const n=validRows.length;
 const mean=key=>n?validRows.reduce((sum,r)=>sum+r[key],0)/n:null;
 const baselineMae=mean("baselineAbs"),challengerMae=mean("challengerAbs");
 return {pairedGames:n,excluded:reasons,baseline,challenger,
  baselineMAE:baselineMae,challengerMAE:challengerMae,
  baselineRMSE:n?Math.sqrt(mean("baselineSq")):null,
  challengerRMSE:n?Math.sqrt(mean("challengerSq")):null,
  maeImprovement:n?baselineMae-challengerMae:null,
  conclusion:n<30?"insufficient_paired_sample_no_accuracy_claim":"descriptive_only_requires_out_of_sample_validation"};
}
module.exports={pairedMetrics};
