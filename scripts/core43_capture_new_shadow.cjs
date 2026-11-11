"use strict";
/* New-only pregame capture. Never reconstruct a past freeze or modify archived predictions. */
const fs=require("node:fs");
const crypto=require("node:crypto");
const {calculatePregameTwoGoalieShadow}=require("./core43_two_goalie_pregame_shadow.cjs");
const time=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
function capture({payload,now=new Date().toISOString()}={}){
 const fail=reason=>({captured:false,reason,production:false,persistable:false});
 if(!payload||!Number.isFinite(time(now))||!Number.isFinite(time(payload.predictionAt))||!Number.isFinite(time(payload.kickoffAt)))return fail("invalid_capture_time");
 // Require actual capture in the immediate pregame window, never historical replay.
 if(time(payload.predictionAt)>time(now)||time(now)-time(payload.predictionAt)>5*60*1000||time(now)>=time(payload.kickoffAt))return fail("not_live_pregame_capture");
 if(!payload.baseline||time(payload.baseline.predictedAt)>time(payload.predictionAt))return fail("invalid_baseline");
 const shadow=calculatePregameTwoGoalieShadow(payload);
 if(!shadow.available)return fail(shadow.reason);
 const frozen={schema:"core43_shadow_capture_v1",gameId:payload.gameId,awayTeam:payload.awayTeam,homeTeam:payload.homeTeam,
  kickoffAt:payload.kickoffAt,predictedAt:payload.predictionAt,inputAsOf:payload.predictionAt,frozenAt:now,
  frozenBeforeKickoff:true,production:false,persistable:false,calibrated:false,experimental:true,
  away:shadow.expectedAwayGoals,home:shadow.expectedHomeGoals,baseline:shadow.baseline,
  goalies:shadow.goalies,coefficient:shadow.coefficient,gsaxFetchedAt:payload.gsaxFetchedAt,
  warning:"Uncalibrated sensitivity, not a production forecast. Capture must be independently retained."};
 const canonical=JSON.stringify(frozen);
 return {captured:true,record:frozen,sha256:crypto.createHash("sha256").update(canonical).digest("hex"),production:false,persistable:false};
}
if(require.main===module){
 const input=process.argv[2],output=process.argv[3];
 if(!input||!output||!output.endsWith(".json")){console.error("Usage: node scripts/core43_capture_new_shadow.cjs INPUT.json OUTPUT.json");process.exitCode=1;}
 else try{
  const result=capture({payload:JSON.parse(fs.readFileSync(input,"utf8"))});
  if(!result.captured)throw Error(result.reason);
  // wx prevents overwriting any previous capture in this workspace.
  fs.writeFileSync(output,JSON.stringify(result,null,2)+"\\n",{flag:"wx",mode:0o600});
  console.log("Captured new shadow artifact: "+output+" sha256="+result.sha256);
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={capture};
