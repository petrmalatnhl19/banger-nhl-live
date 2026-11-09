"use strict";
/* Real Supabase read-only eligibility audit; never writes or manufactures goal forecasts. */
const {readTable,evaluateCandidates}=require("./monitor_core43_revisions.cjs");
function summarize({predictions=[],schedules=[],evidence=[],revisions=[],now}={}){
 const active=new Set(schedules.filter(s=>Date.parse(s.kickoff_at)>Date.parse(now)).map(s=>String(s.game_id)));
 const candidates=evaluateCandidates({predictions:predictions.filter(p=>active.has(String(p.game_id))),schedules,evidence,now});
 const existing=new Set(revisions.map(r=>[r.game_id,r.model,r.revision_kind].join("|")));
 const results=candidates.map(c=>{
  if(!c.eligible)return {gameId:c.gameId,eligible:false,reason:c.reason};
  const k=[c.gameId,c.proposal.model,"pregame"].join("|");
  return {gameId:c.gameId,eligible:!existing.has(k),reason:existing.has(k)?"already_has_revision":"eligible_evidence_only_computed_forecast_required"};
 });
 const reasons={};
 for(const x of results)reasons[x.reason]=(reasons[x.reason]||0)+1;
 return {mode:"read_only",asOf:now,activeGames:active.size,checked:results.length,evidenceEligible:results.filter(x=>x.eligible).length,readyToWrite:0,reasonCounts:reasons,results};
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const now=new Date().toISOString();
 const [predictions,schedules,evidence,revisions]=await Promise.all([
  readTable(url,key,"nhl_prediction_archive","select=game_id,away_team,home_team,core41_predicted_at&core41_predicted_at=not.is.null&limit=1000"),
  readTable(url,key,"nhl_core43_schedule_snapshots","select=game_id,away_team,home_team,kickoff_at&kickoff_at=gt."+encodeURIComponent(now)+"&limit=1000"),
  readTable(url,key,"nhl_core43_starter_evidence","select=game_id,team_code,goalie_id,evidence_status,source_name,source_url,source_published_at,verified_at&verified_at=lte."+encodeURIComponent(now)+"&limit=1000"),
  readTable(url,key,"nhl_prediction_revisions","select=game_id,model,revision_kind&limit=1000")
 ]);
 console.log(JSON.stringify(summarize({predictions,schedules,evidence,revisions,now}),null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={summarize};
