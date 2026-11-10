"use strict";
/* Single server-side read-only runner. Never import from a public web bundle. */
const {fetchRows,reportFromRows}=require("./core43_supabase_readonly_report.cjs");
const {auditArchive}=require("./core43_archive_coverage_audit.cjs");
const TABLES={
 predictions:["nhl_prediction_archive","game_id,away_team,home_team,core41_predicted_at,core42_predicted_at"],
 schedules:["nhl_core43_schedule_snapshots","game_id,fetched_at,kickoff_at,away_team,home_team"],
 goalies:["nhl_core43_rotowire_observations","game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at"],
 identityMap:["nhl_core43_goalie_identity_map","goalie_id,goalie_name,team_code,observed_at"],
 starterEvidence:["nhl_core43_starter_evidence","game_id,team_code,goalie_id,evidence_status,source_url,source_published_at,verified_at"]
};
function buildReport(data){
 const coverage=auditArchive(data);
 const starters=reportFromRows(data);
 return {mode:"read_only_shadow",generatedAt:new Date().toISOString(),total:starters.total,
  coverage:coverage.coverage,starterReadiness:starters.counts,
  games:starters.games.map(game=>({...game,coverageStatus:
   coverage.gameIds.missingPredictionTime.includes(game.gameId)?"missing_prediction_time":
   coverage.gameIds.missingFrozenSchedule.includes(game.gameId)?"missing_frozen_schedule":"usable_frozen_schedule"})),
  production:false,persistable:false};
}
async function run({url,key,gameId,fetchImpl=fetch}){
 if(!key)throw Error("Missing server-side SUPABASE_SECRET_KEY");
 if(gameId!==undefined&&!/^\d+$/.test(String(gameId)))throw Error("Game ID must be numeric");
 const data={};
 for(const [alias,[table,select]] of Object.entries(TABLES))
  data[alias]=await fetchRows({url,key,table,select,gameId,fetchImpl});
 return buildReport(data);
}
if(require.main===module){
 run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SECRET_KEY,gameId:process.argv[2]})
  .then(report=>console.log(JSON.stringify(report,null,2)))
  .catch(error=>{console.error(error.message);process.exitCode=1;});
}
module.exports={buildReport,run};
