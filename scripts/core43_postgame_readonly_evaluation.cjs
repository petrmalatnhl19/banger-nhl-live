"use strict";
/* Experimental CORE 4.3 postgame evaluation. Read-only: no database mutations. */
const crypto=require("node:crypto");
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
function evaluate(rows,game){
 if(!Array.isArray(rows)||!rows.length)return {status:"no_archived_capture",evaluated:0};
 if(!game||!["FINAL","OFF"].includes(String(game.gameState||"").toUpperCase()))return {status:"game_not_final",evaluated:0};
 const awayGoals=game.awayTeam?.score,homeGoals=game.homeTeam?.score;
 if(!Number.isInteger(awayGoals)||!Number.isInteger(homeGoals)||awayGoals<0||homeGoals<0)throw Error("invalid_final_score");
 const evaluations=[];
 for(const row of rows){
  const p=row.payload;
  if(!p||p.schema!=="core43_shadow_capture_v1"||p.production!==false||p.experimental!==true||p.gameId?.toString()!==String(row.game_id))throw Error("invalid_archived_capture");
  if(!/^[a-f0-9]{64}$/.test(row.capture_sha256||"")||crypto.createHash("sha256").update(JSON.stringify(p)).digest("hex")!==row.capture_sha256)throw Error("archive_capture_hash_mismatch");
  if(Date.parse(row.frozen_at)>=Date.parse(row.kickoff_at)||!Number.isFinite(Date.parse(row.frozen_at)))throw Error("invalid_capture_time");
  if(String(game.id)!==String(row.game_id))throw Error("game_id_mismatch");
  const away=Number(p.away),home=Number(p.home);
  if(!Number.isFinite(away)||!Number.isFinite(home)||away<0||home<0)throw Error("invalid_projected_goals");
  const actualWinner=awayGoals>homeGoals?"away":homeGoals>awayGoals?"home":"tie";
  const projectedLeader=away>home?"away":home>away?"home":"tie";
  evaluations.push({gameId:String(row.game_id),modelVersion:row.model_version,archivedAt:row.archived_at,projectedGoals:{away,home},actualGoals:{away:awayGoals,home:homeGoals},absoluteError:{away:Number(Math.abs(away-awayGoals).toFixed(3)),home:Number(Math.abs(home-homeGoals).toFixed(3))},totalAbsoluteError:Number((Math.abs(away-awayGoals)+Math.abs(home-homeGoals)).toFixed(3)),projectedLeader,actualWinner,leaderMatched:projectedLeader===actualWinner,experimental:true});
 }
 return {status:"evaluated_read_only",evaluated:evaluations.length,results:evaluations,notice:"Projected goal leader is not a calibrated win probability. No Brier score or accuracy rate from a single game."};
}
async function run({url,key,gameId,fetchImpl=fetch}={}){
 if(!/^\d+$/.test(String(gameId||"")))throw Error("invalid_game_id");
 if(!key)throw Error("missing_server_credentials");
 const rows=await fetchRows({url,key,table:"nhl_core43_shadow_capture_archive",select:"game_id,model_version,archived_at,frozen_at,kickoff_at,capture_sha256,payload",gameId:String(gameId),fetchImpl});
 if(!rows.length)return {status:"no_archived_capture",evaluated:0};
 const response=await fetchImpl("https://api-web.nhle.com/v1/gamecenter/"+encodeURIComponent(gameId)+"/landing");
 if(!response.ok)throw Error("NHL game landing HTTP "+response.status);
 return evaluate(rows,await response.json());
}
if(require.main===module)run({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,gameId:process.env.CORE43_EVAL_GAME_ID}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={evaluate,run};
