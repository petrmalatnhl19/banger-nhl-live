"use strict";
/* Server-side only, read-only Supabase report. Never bundle into browser assets. */
const {inspectGameWithStarterEvidence}=require("./core43_game_starter_diagnostic.cjs");
const TABLES={
 predictions:["nhl_prediction_archive","game_id,away_team,home_team,core41_predicted_at,core42_predicted_at"],
 schedules:["nhl_core43_schedule_snapshots","game_id,fetched_at,kickoff_at,away_team,home_team"],
 goalies:["nhl_core43_rotowire_observations","game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at"],
 identityMap:["nhl_core43_goalie_identity_map","goalie_id,goalie_name,team_code,observed_at"],
 starterEvidence:["nhl_core43_starter_evidence","game_id,team_code,goalie_id,evidence_status,source_url,source_published_at,verified_at"]
};
async function fetchRows({url,key,table,select,gameId,fetchImpl=fetch}){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw Error("Invalid Supabase project URL");
 const all=[];
 for(let offset=0;offset<100000;offset+=500){
  const params=new URLSearchParams({select,limit:"500",offset:String(offset)});
  if(gameId&&table!=="nhl_core43_goalie_identity_map")params.set("game_id","eq."+gameId);
  const response=await fetchImpl(url+"/rest/v1/"+table+"?"+params,{method:"GET",headers:{apikey:key,Authorization:"Bearer "+key,Accept:"application/json"}});
  if(!response.ok)throw Error("Supabase read failed: "+table+" HTTP "+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))throw Error("Invalid Supabase rows for "+table);
  all.push(...rows);
  if(rows.length<500)return all;
 }
 throw Error("Supabase pagination safety limit exceeded: "+table);
}
function reportFromRows(data){
 const games=[];
 const predictions=data.predictions||[];
 for(const prediction of predictions){
  const asOf=prediction.core42_predicted_at||prediction.core41_predicted_at;
  const schedules=(data.schedules||[]).filter(s=>String(s.game_id)===String(prediction.game_id)&&
   s.away_team===prediction.away_team&&s.home_team===prediction.home_team&&
   typeof s.fetched_at==="string"&&Number.isFinite(Date.parse(s.fetched_at))&&
   typeof asOf==="string"&&Number.isFinite(Date.parse(asOf))&&Date.parse(s.fetched_at)<=Date.parse(asOf));
  schedules.sort((a,b)=>Date.parse(b.fetched_at)-Date.parse(a.fetched_at));
  const gameId=String(prediction.game_id);
  const result=inspectGameWithStarterEvidence({prediction,schedule:schedules[0],
   goalies:(data.goalies||[]).filter(r=>String(r.game_id)===gameId),
   identityMap:data.identityMap||[],
   starterEvidence:(data.starterEvidence||[]).filter(r=>String(r.game_id)===gameId)});
  games.push({gameId,awayTeam:prediction.away_team,homeTeam:prediction.home_team,
   status:result.starterReadiness||"unavailable",reason:result.reason||null,
   away:result.sides?.away?.starterReadiness||null,home:result.sides?.home?.starterReadiness||null,
   production:false,persistable:false});
 }
 return {mode:"read_only_shadow",total:games.length,counts:{
  ready_confirmed:games.filter(g=>g.status==="ready_confirmed").length,
  ready_projected:games.filter(g=>g.status==="ready_projected").length,
  unavailable:games.filter(g=>g.status==="unavailable").length},games};
}
async function run({url,key,gameId,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 const data={};
 for(const [alias,[table,select]] of Object.entries(TABLES))
  data[alias]=await fetchRows({url,key,table,select,gameId,fetchImpl});
 return reportFromRows(data);
}
if(require.main===module){
 const gameId=process.argv[2];
 if(gameId&&!/^\d+$/.test(gameId)){console.error("Game ID must be numeric");process.exitCode=1;}
 else run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY,gameId})
  .then(result=>console.log(JSON.stringify(result,null,2)))
  .catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={fetchRows,reportFromRows,run};
