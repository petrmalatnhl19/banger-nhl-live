"use strict";
/* Read-only evaluation of frozen pregame goalie picks against verified actual starters.
 * Missing outcomes are excluded, never counted as correct or incorrect.
 */
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const id=x=>/^\d+$/.test(String(x??""))?String(x):null;
function evaluateGoalieAccuracy(rows=[]){
 const excluded={},details=[];let correct=0,incorrect=0;
 for(const row of rows){
  const skip=reason=>{excluded[reason]=(excluded[reason]||0)+1;details.push({gameId:row?.gameId,teamCode:row?.teamCode,result:"excluded",reason});};
  if(!row){skip("invalid_row");continue;}
  const kickoff=time(row.kickoffAt),predicted=time(row.predictedAt),actualVerified=time(row.actualVerifiedAt);
  if(![kickoff,predicted,actualVerified].every(Number.isFinite)||predicted>=kickoff||actualVerified<kickoff){skip("invalid_timing");continue;}
  const pick=id(row.predictedGoalieId),actual=id(row.actualStarterGoalieId);
  if(!pick||!actual){skip("missing_goalie_id");continue;}
  if(row.actualSourceStatus!=="verified"){skip("unverified_actual_starter");continue;}
  if(row.predictionStatus!=="confirmed"&&row.predictionStatus!=="projected"){skip("unknown_or_conflicted_prediction");continue;}
  const match=pick===actual;
  if(match)correct++;else incorrect++;
  details.push({gameId:row.gameId,teamCode:row.teamCode,result:match?"correct":"incorrect",predictionStatus:row.predictionStatus});
 }
 const evaluated=correct+incorrect;
 return {mode:"read_only",evaluated,correct,incorrect,excluded,accuracy:evaluated?correct/evaluated:null,conclusion:evaluated<30?"insufficient_sample_no_accuracy_claim":"descriptive_only_requires_out_of_sample_validation",details};
}
module.exports={evaluateGoalieAccuracy};
