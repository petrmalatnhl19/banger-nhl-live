"use strict";
/* Read-only preflight: explain eligibility without relaxing the 180-minute write gate. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
async function explain({url,key,gameId,now=new Date().toISOString(),fetchImpl=fetch}={}){
 if(!/^\d+$/.test(String(gameId??""))||!valid(now)||!key)throw Error("invalid_preflight_context");
 const [schedules,predictions,observations,identities,snapshots]=await Promise.all([
  fetchRows({url,key,table:"nhl_core43_schedule_snapshots",select:"game_id,away_team,home_team,kickoff_at,fetched_at",gameId:String(gameId),fetchImpl}),
  fetchRows({url,key,table:"nhl_prediction_archive",select:"game_id,away_team,home_team,core42_predicted_at,core42_away,core42_home",gameId:String(gameId),fetchImpl}),
  fetchRows({url,key,table:"nhl_core43_rotowire_observations",select:"game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at",gameId:String(gameId),fetchImpl}),
  fetchRows({url,key,table:"nhl_core43_goalie_identity_map",select:"goalie_id,goalie_name,team_code,observed_at",fetchImpl}),
  fetchRows({url,key,table:"nhl_core43_goalie_snapshots",select:"goalie_id,team_code,situation,fetched_at,created_at,source_sha256,x_goals_against,goals_against,shots_against",fetchImpl})
 ]);
 const eligible=schedules.filter(s=>valid(s.kickoff_at)&&valid(s.fetched_at)&&Date.parse(s.fetched_at)<=Date.parse(now)).sort((a,b)=>Date.parse(b.fetched_at)-Date.parse(a.fetched_at));
 const schedule=eligible[0]||null;
 const remainingMinutes=schedule?Math.ceil((Date.parse(schedule.kickoff_at)-Date.parse(now))/60000):null;
 const baseline=predictions.filter(p=>schedule&&p.away_team===schedule.away_team&&p.home_team===schedule.home_team&&valid(p.core42_predicted_at)&&Date.parse(p.core42_predicted_at)<=Date.parse(now)&&Date.parse(p.core42_predicted_at)<Date.parse(schedule.kickoff_at)&&typeof p.core42_away==="number"&&typeof p.core42_home==="number");
 const teams=schedule?[schedule.away_team,schedule.home_team]:[];
 const observedTeams=teams.filter(team=>observations.some(o=>o.team_code===team&&valid(o.observed_at)&&Date.parse(o.observed_at)<=Date.parse(now)));
 const goalieIdentityTeams=teams.filter(team=>identities.some(i=>i.team_code===team&&valid(i.observed_at)&&Date.parse(i.observed_at)<=Date.parse(now)));
 const gsaxTeams=teams.filter(team=>snapshots.some(s=>s.team_code===team&&s.situation==="all"&&valid(s.fetched_at)&&valid(s.created_at)&&Date.parse(s.fetched_at)<=Date.parse(now)&&Date.parse(s.created_at)<=Date.parse(now)&&Number(s.shots_against)>=30));
 const reasons=[];
 if(!schedule)reasons.push("missing_valid_schedule");
 else{
  if(remainingMinutes<=0)reasons.push("game_already_started");
  else if(remainingMinutes>180)reasons.push("outside_180_minute_capture_window");
  if(baseline.length!==1)reasons.push("missing_or_ambiguous_core42_baseline");
  if(observedTeams.length!==2)reasons.push("missing_goalie_observations");
  if(goalieIdentityTeams.length!==2)reasons.push("missing_goalie_identity_coverage");
  if(gsaxTeams.length!==2)reasons.push("missing_archived_gsax_coverage");
 }
 return {mode:"read_only_preflight",gameId:String(gameId),checkedAt:now,teams,remainingMinutes,checks:{schedule:!!schedule,baseline:baseline.length===1,goalieObservations:observedTeams.length===2,goalieIdentityCoverage:goalieIdentityTeams.length===2,archivedGsaxCoverage:gsaxTeams.length===2,insideCaptureWindow:remainingMinutes!==null&&remainingMinutes>0&&remainingMinutes<=180},reasons,warning:"Coverage is diagnostic only; exact goalie matching and frozen source validation still occur in the capture path.",writes:0};
}
module.exports={explain};
