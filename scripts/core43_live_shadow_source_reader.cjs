"use strict";
/* Server-only Supabase reader. This module does NOT persist shadow captures. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const {prepareLiveShadowCapture}=require("./core43_prepare_live_shadow_capture.cjs");
const TABLES={
 schedules:["nhl_core43_schedule_snapshots","game_id,away_team,home_team,kickoff_at,fetched_at"],
 predictions:["nhl_prediction_archive","game_id,away_team,home_team,core42_predicted_at,core42_away,core42_home"],
 observations:["nhl_core43_rotowire_observations","game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at"],
 identities:["nhl_core43_goalie_identity_map","goalie_id,goalie_name,team_code,observed_at"],
 goalieSnapshotRows:["nhl_core43_goalie_snapshots","goalie_id,team_code,situation,fetched_at,created_at,source_sha256,x_goals_against,goals_against,shots_against"]
};
async function loadLiveShadowSources({url,key,gameId,fetchImpl=fetch}={}){
 if(!key||!/^[0-9]+$/.test(String(gameId??"")))throw Error("missing_server_credentials_or_game_id");
 const data={};
 for(const [alias,[table,select]] of Object.entries(TABLES))
  data[alias]=await fetchRows({url,key,table,select,gameId:alias==="identities"||alias==="goalieSnapshotRows"?undefined:String(gameId),fetchImpl});
 return data;
}
async function inspectLiveShadowGame({url,key,gameId,awayTeam,homeTeam,asOf,now,fetchImpl=fetch}={}){
 const data=await loadLiveShadowSources({url,key,gameId,fetchImpl});
 // Do not substitute the wall clock for a previously archived prediction time.
 return prepareLiveShadowCapture({...data,gameId,awayTeam,homeTeam,asOf,now});
}
if(require.main===module){
 const [gameId,awayTeam,homeTeam,asOf]=process.argv.slice(2);
 const now=new Date().toISOString();
 inspectLiveShadowGame({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,gameId,awayTeam,homeTeam,asOf,now})
  .then(result=>console.log(JSON.stringify({mode:"read_only",...result},null,2)))
  .catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={TABLES,loadLiveShadowSources,inspectLiveShadowGame};
