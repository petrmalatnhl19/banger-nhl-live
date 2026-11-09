/* Read-only CORE 4.3 archive evaluation. Never invent missing forecasts.
 * Uses the actual immutable revision table and original archive.
 */
"use strict";
const {pairedMetrics}=require("./core43_paired_evaluation.cjs");
const date=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function assemblePairs({archive=[],revisions=[],schedules=[]}={}){
 const scheduleByGame=new Map(),ambiguous=new Set();
 for(const s of schedules){
  const id=String(s.game_id);
  if(!date(s.kickoff_at))continue;
  const prev=scheduleByGame.get(id);
  if(prev&&(prev.kickoff_at!==s.kickoff_at||prev.away_team!==s.away_team||prev.home_team!==s.home_team))ambiguous.add(id);
  else scheduleByGame.set(id,s);
 }
 const revisionsByGame=new Map();
 for(const r of revisions){
  if(r.model!=="core43_shadow"||r.revision_kind!=="shadow"||!date(r.predicted_at)||!r.input_snapshot||r.input_snapshot.production!==false)continue;
  const id=String(r.game_id),schedule=scheduleByGame.get(id);
  if(!schedule||ambiguous.has(id)||Date.parse(r.predicted_at)>=Date.parse(schedule.kickoff_at))continue;
  if(r.away_team!==schedule.away_team||r.home_team!==schedule.home_team)continue;
  const old=revisionsByGame.get(id);
  if(!old||Date.parse(r.predicted_at)>Date.parse(old.predicted_at))revisionsByGame.set(id,r);
 }
 const rows=[];
 for(const a of archive){
  if(a.status!=="final"||!Number.isFinite(a.actual_away)||!Number.isFinite(a.actual_home))continue;
  const id=String(a.game_id),s=scheduleByGame.get(id),r=revisionsByGame.get(id);
  if(!s||ambiguous.has(id)||!r||r.away_team!==a.away_team||r.home_team!==a.home_team||s.away_team!==a.away_team||s.home_team!==a.home_team)continue;
  rows.push({gameId:a.game_id,kickoffAt:s.kickoff_at,actual:{away:a.actual_away,home:a.actual_home},
   core41:{away:a.core41_away,home:a.core41_home,predictedAt:a.core41_predicted_at},
   core43:{away:r.predicted_away,home:r.predicted_home,predictedAt:r.predicted_at}});
 }
 return rows;
}
async function read(url,key,table,query,fetchImpl=fetch){
 const response=await fetchImpl(url+"/rest/v1/"+table+"?"+query,{headers:{apikey:key,Authorization:"Bearer "+key}});
 if(!response.ok)throw Error("archive_read_failed_"+table+"_"+response.status);
 return response.json();
}
async function main(){
 const url=(process.env.SUPABASE_URL||"").replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!key)throw Error("missing_server_credentials");
 const [archive,revisions,schedules]=await Promise.all([
  read(url,key,"nhl_prediction_archive","select=game_id,status,away_team,home_team,actual_away,actual_home,core41_away,core41_home,core41_predicted_at&status=eq.final&limit=1000"),
  read(url,key,"nhl_prediction_revisions","select=game_id,model,revision_kind,predicted_at,away_team,home_team,predicted_away,predicted_home,input_snapshot&model=eq.core43_shadow&revision_kind=eq.shadow&limit=1000"),
  read(url,key,"nhl_core43_schedule_snapshots","select=game_id,away_team,home_team,kickoff_at&limit=1000")
 ]);
 const pairs=assemblePairs({archive,revisions,schedules});
 console.log(JSON.stringify({mode:"read_only",archiveFinals:archive.length,shadowRevisions:revisions.length,...pairedMetrics(pairs)},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={assemblePairs,read};
