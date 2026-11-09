/* Experimental CORE 4.3 revision writer. Dry-run by default.
 * Input JSON: {prediction,schedule,evidence,asOf,model,predictedAway,predictedHome,inputSnapshot}
 * Production collector is intentionally NOT connected.
 */
"use strict";
const fs=require("node:fs");
const {proposeRevision}=require("../core43-revision-gate.js");
function buildRow(payload){
 if(!payload||typeof payload!=="object")throw Error("invalid_payload");
 const decision=proposeRevision(payload);
 if(!decision.eligible)throw Error("revision_rejected:"+decision.reason);
 const p=decision.proposal,game=payload.schedule;
 const away=payload.predictedAway,home=payload.predictedHome;
 if(![away,home].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=20))throw Error("invalid_expected_goals");
 const snapshot=payload.inputSnapshot;
 if(!snapshot||typeof snapshot!=="object"||Array.isArray(snapshot))throw Error("missing_input_snapshot");
 const row={game_id:p.gameId,model:p.model,revision_kind:"pregame",predicted_at:p.revisionAsOf,
  kickoff_at:game.kickoff_at,away_team:game.away_team,home_team:game.home_team,
  predicted_away:away,predicted_home:home,away_goalie_id:p.awayGoalieId,
  home_goalie_id:p.homeGoalieId,source_prediction_at:p.originalPredictedAt,input_snapshot:snapshot};
 return Object.freeze(row);
}
async function writeRow(row,{url,key,fetchImpl=fetch}={}){
 if(!url||!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)||!key)throw Error("missing_or_invalid_server_credentials");
 const response=await fetchImpl(url.replace(/\/$/,"")+"/rest/v1/nhl_prediction_revisions",{
  method:"POST",headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"return=minimal"},
  body:JSON.stringify(row)});
 if(!response.ok)throw Error("revision_insert_failed_http_"+response.status);
 return {inserted:true};
}
async function main(){
 const args=process.argv.slice(2),write=args.includes("--write");
 const paths=args.filter(a=>a!=="--write");
 if(paths.length!==1)throw Error("usage: node scripts/write_core43_revision.cjs <payload.json> [--write]");
 const payload=JSON.parse(fs.readFileSync(paths[0],"utf8"));
 const row=buildRow(payload);
 if(!write){console.log("DRY RUN: eligible revision; no database write",JSON.stringify(row));return;}
 if(process.env.CORE43_EXPERIMENTAL_WRITE!=="YES")throw Error("write_requires_CORE43_EXPERIMENTAL_WRITE_YES");
 await writeRow(row,{url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY});
 console.log("Experimental revision inserted; original archive untouched");
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={buildRow,writeRow};
