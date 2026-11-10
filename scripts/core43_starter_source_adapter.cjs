/* Normalizes externally collected goalie announcements without guessing starter status.
 * This adapter does NOT scrape providers or write to Supabase.
 */
"use strict";
const {validateFrozenEvidence}=require("../core43-starter-gate.js");
function normalizeStarterAnnouncement({raw,game,asOf,verifiedAt}={}){
 const fail=reason=>({accepted:false,reason,evidence:null});
 if(!raw||!game||!Number.isFinite(Date.parse(asOf))||!Number.isFinite(Date.parse(verifiedAt)))return fail("missing_context");
 const status=String(raw.status||"").trim().toLowerCase();
 if(status!=="confirmed"||raw.confirmationBasis!=="explicit_pregame_report")return fail("not_explicitly_confirmed");
 if(raw.gameId!==game.gameId||raw.teamCode!==game.awayTeam&&raw.teamCode!==game.homeTeam)return fail("game_or_team_mismatch");
 const evidence={gameId:raw.gameId,teamCode:raw.teamCode,goalieId:raw.goalieId,status,
  sourceName:raw.sourceName,sourceUrl:raw.sourceUrl,sourcePublishedAt:raw.sourcePublishedAt,verifiedAt};
 const result=validateFrozenEvidence(evidence,game,asOf);
 if(!result.accepted)return fail(result.reason);
 return {accepted:true,reason:null,evidence:{
  game_id:result.gameId,team_code:result.teamCode,goalie_id:result.goalieId,
  evidence_status:"confirmed",source_name:result.sourceName,source_url:result.sourceUrl,
  source_published_at:result.sourcePublishedAt,verified_at:result.verifiedAt
 }};
}
module.exports={normalizeStarterAnnouncement};
