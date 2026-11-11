"use strict";
/* Read-only audit of immutable CORE 4.3 shadow inputs; never infer confirmations. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const validDate=value=>typeof value==="string"&&Number.isFinite(Date.parse(value));
function audit(rows=[]){
 const totals={rows:rows.length,games:new Set(rows.map(r=>String(r.game_id))).size,
  missingGoalieId:0,missingGsax:0,missingPredictionAt:0,
  futureCaptured:0,missingStarterPublishedAt:0,publishedAfterPrediction:0,
  missingStarterVerifiedAt:0,verifiedAfterPrediction:0,
  confirmed:0,projected:0,unavailable:0,otherReadiness:0,
  fullyTimeQualified:0};
 const reasonsByGame={};
 for(const r of rows){
  const reasons=[];
  if(!r.goalie_id) {totals.missingGoalieId++;reasons.push("missing_goalie_id");}
  if(r.gsax===null||r.gsax===undefined){totals.missingGsax++;reasons.push("missing_gsax");}
  const at=validDate(r.prediction_at)?Date.parse(r.prediction_at):null;
  if(at===null){totals.missingPredictionAt++;reasons.push("missing_prediction_time");}
  if(validDate(r.captured_at)&&at!==null&&Date.parse(r.captured_at)>at){
   totals.futureCaptured++;reasons.push("captured_after_prediction");
  }
  if(!validDate(r.starter_published_at)){totals.missingStarterPublishedAt++;reasons.push("missing_publication_time");}
  else if(at===null||Date.parse(r.starter_published_at)>at){
   totals.publishedAfterPrediction++;reasons.push("published_after_prediction");
  }
  if(!validDate(r.starter_verified_at)){totals.missingStarterVerifiedAt++;reasons.push("missing_verification_time");}
  else if(at===null||Date.parse(r.starter_verified_at)>at){
   totals.verifiedAfterPrediction++;reasons.push("verified_after_prediction");
  }
  if(r.readiness==="ready_confirmed")totals.confirmed++;
  else if(r.readiness==="ready_projected")totals.projected++;
  else if(!r.readiness||r.readiness==="unavailable")totals.unavailable++;
  else totals.otherReadiness++;
  if(reasons.length===0)totals.fullyTimeQualified++;
  else {
   const id=String(r.game_id);
   if(!reasonsByGame[id])reasonsByGame[id]=[];
   reasonsByGame[id].push({side:r.side||null,reasons});
  }
 }
 return {mode:"read_only_shadow",production:false,persistable:false,
  ...totals,affectedGames:Object.keys(reasonsByGame).length,
  // Keep private goalie identities out of published artifacts.
  issueCounts:Object.values(reasonsByGame).flat().flatMap(x=>x.reasons).reduce((a,k)=>(a[k]=(a[k]||0)+1,a),{})};
}
async function run({url,key,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const rows=await fetchRows({url,key,table:"nhl_core43_shadow_inputs",
  select:"game_id,side,goalie_id,gsax,prediction_at,captured_at,starter_published_at,starter_verified_at,readiness",
  fetchImpl});
 return audit(rows);
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(r=>console.log(JSON.stringify(r,null,2)))
 .catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={audit,run};
