"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {run}=require("./core43_cal04_scheduled_dryrun.cjs");
const phase=process.argv[2],dir=process.argv[3];
if(!["first","second"].includes(phase)||!dir)throw Error("usage: node script first|second directory");
const now=phase==="first"?"2026-11-09T22:00:00Z":"2026-11-09T22:10:00Z";
const sha="a".repeat(64);
const data={
 nhl_core43_schedule_snapshots:[{game_id:42,away_team:"DAL",home_team:"NYR",kickoff_at:"2026-11-09T23:00:00Z",fetched_at:"2026-11-09T20:00:00Z"}],
 nhl_prediction_archive:[{game_id:42,away_team:"DAL",home_team:"NYR",core42_predicted_at:"2026-11-09T12:00:00Z",core42_away:3,core42_home:2.8}],
 nhl_core43_rotowire_observations:[["DAL","Goalie A"],["NYR","Goalie B"]].map(([team_code,goalie_name])=>({game_id:42,team_code,goalie_name,observed_status:"projected",observed_at:"2026-11-09T14:00:00Z",source_snapshot_at:"2026-11-09T13:00:00Z"})),
 nhl_core43_goalie_identity_map:[["DAL","Goalie A","8471234"],["NYR","Goalie B","8475678"]].map(([team_code,goalie_name,goalie_id])=>({team_code,goalie_name,goalie_id,observed_at:"2026-11-09T12:00:00Z"})),
 nhl_core43_goalie_snapshots:[["DAL","8471234",52,49,600],["NYR","8475678",40,42,500]].map(([team_code,goalie_id,x_goals_against,goals_against,shots_against])=>({team_code,goalie_id,x_goals_against,goals_against,shots_against,situation:"all",fetched_at:"2026-11-09T21:30:00Z",created_at:"2026-11-09T21:31:00Z",source_sha256:sha}))
};
async function fetchImpl(url,opts){
 assert.equal(opts.method,"GET");
 const u=new URL(url),table=u.pathname.split("/").at(-1),rows=data[table];
 assert.ok(rows,"unexpected table: "+table);
 const filter=u.searchParams.get("game_id");
 return {ok:true,json:async()=>filter?rows.filter(r=>String(r.game_id)===filter.slice(3)):rows};
}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const ledgerPath=dir+"/ledger.json";
 if(phase==="second"){
  assert.ok(fs.existsSync(ledgerPath),"downloaded artifact missing");
  process.env.CORE43_CAL04_LEDGER_PATH=ledgerPath;
 }
 const report=await run({url:"https://example.supabase.co",key:"mock-only",now,fetchImpl});
 if(phase==="first"){
  assert.equal(report.ready,1,JSON.stringify(report));
  assert.equal(report.ledger.keys.length,4);
  fs.writeFileSync(ledgerPath,JSON.stringify(report.ledger));
 }else{
  assert.equal(report.duplicates,1,JSON.stringify(report));
  assert.equal(report.ready,0);
  assert.equal(report.ledger.keys.length,4);
 }
 assert.equal(report.databaseWrites,0);
 fs.writeFileSync(dir+"/report-"+phase+".json",JSON.stringify(report,null,2));
 console.log("CORE43-CAL-05 "+phase+" artifact round-trip passed");
})().catch(e=>{console.error(e);process.exitCode=1});
