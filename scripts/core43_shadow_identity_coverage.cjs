"use strict";
/* Read-only pregame identity coverage. Never rewrites frozen inputs or upgrades starters. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const {reconcileIdentities}=require("./core43_rotowire_identity_reconcile.cjs");
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function audit({inputs=[],observations=[],identities=[]}={}){
 const counts={rows:inputs.length,missingFrozenId:0,resolvableAsOf:0,unresolvedAsOf:0,ambiguousAsOf:0,lateOrInvalidObservation:0,alreadyFrozen:0};
 for(const input of inputs){
  if(input.goalie_id){counts.alreadyFrozen++;continue;}
  counts.missingFrozenId++;
  if(!validTime(input.prediction_at)){counts.unresolvedAsOf++;continue;}
  const relevant=observations.filter(o=>String(o.game_id)===String(input.game_id)&&o.team_code===input.team_code);
  const resolved=reconcileIdentities({observations:relevant,identities,asOf:input.prediction_at});
  const eligible=resolved.filter(x=>x.identityResolved);
  const ids=new Set(eligible.map(x=>x.goalieId));
  if(ids.size===1)counts.resolvableAsOf++;
  else if(ids.size>1||resolved.some(x=>x.reason==="identity_ambiguous"))counts.ambiguousAsOf++;
  else if(resolved.length&&resolved.every(x=>x.reason==="invalid_or_late_observation"))counts.lateOrInvalidObservation++;
  else counts.unresolvedAsOf++;
 }
 return {mode:"read_only_shadow",production:false,persistable:false,counts,
  note:"Potential historical identity coverage only. Resolvable does not mean confirmed or eligible for retroactive archive changes."};
}
async function run({url,key,fetchImpl=fetch}={}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const [inputs,observations,identities]=await Promise.all([
  fetchRows({url,key,table:"nhl_core43_shadow_inputs",select:"game_id,team_code,goalie_id,prediction_at",fetchImpl}),
  fetchRows({url,key,table:"nhl_core43_rotowire_observations",select:"game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at",fetchImpl}),
  fetchRows({url,key,table:"nhl_core43_goalie_identity_map",select:"team_code,normalized_name,goalie_id,observed_at",fetchImpl})
 ]);
 return audit({inputs,observations,identities});
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY})
 .then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={audit,run};
