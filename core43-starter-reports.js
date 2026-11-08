/* CORE 4.3: normalize external goalie starter reports, fail closed.
 * Source must provide explicit NHL goalie ID, official game ID, team,
 * published timestamp and original citation URL. Never promote a projection.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43StarterReports=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
function normalize(report,game,observedAt){
 const fail=reason=>({accepted:false,reason});
 if(!report||!game||!Number.isFinite(Date.parse(observedAt)))return fail("invalid_input");
 if(!Number.isInteger(game.gameId)||!Number.isFinite(Date.parse(game.kickoffUTC)))return fail("invalid_schedule");
 if(report.gameId!==game.gameId)return fail("game_mismatch");
 if(report.teamCode!==game.awayTeam&&report.teamCode!==game.homeTeam)return fail("team_mismatch");
 if(!/^\d+$/.test(String(report.goalieId||"")))return fail("missing_nhl_goalie_id");
 if(report.status!=="confirmed")return fail("not_confirmed");
 if(report.confirmationBasis!=="explicit_pregame_report")return fail("unsupported_confirmation_basis");
 if(typeof report.sourceName!=="string"||report.sourceName.trim().length<3)return fail("missing_source");
 if(typeof report.sourceUrl!=="string"||!/^https:\/\//.test(report.sourceUrl))return fail("missing_source_url");
 const published=Date.parse(report.sourcePublishedAt),observed=Date.parse(observedAt),kickoff=Date.parse(game.kickoffUTC);
 if(!Number.isFinite(published))return fail("missing_publication_time");
 if(published>observed)return fail("published_after_observation");
 if(observed>=kickoff||published>=kickoff)return fail("not_pregame");
 return {accepted:true,reason:null,evidence:{
   game_id:game.gameId,team_code:report.teamCode,goalie_id:String(report.goalieId),
   evidence_status:"confirmed",source_name:report.sourceName,
   source_url:report.sourceUrl,source_published_at:report.sourcePublishedAt,
   verified_at:observedAt
 }};
}
return {normalize};
});
