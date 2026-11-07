/* CORE 4.3: season-summary goalie snapshot, experimental.
 * MoneyPuck seasonSummary/2026/regular/goalies.csv contains cumulative
 * player/situation rows, not game-level rows.
 * Every snapshot MUST be archived with fetchedAt BEFORE the prediction.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43SeasonGSAx=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const n=x=>typeof x==="number"&&Number.isFinite(x)?x:(typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):NaN);
const t=x=>typeof x==="string"?Date.parse(x):NaN;
const unavailable=reason=>({available:false,reason,value:null});
function goalieSnapshot(rows,{goalieId,team,situation="all",fetchedAt,kickoff,minShots=30}={}){
 if(!Array.isArray(rows)||goalieId==null||!Number.isFinite(t(fetchedAt))||!Number.isFinite(t(kickoff)))return unavailable("invalid_input");
 if(t(fetchedAt)>=t(kickoff))return unavailable("not_pregame_snapshot");
 const matches=rows.filter(r=>r&&String(r.playerId)===String(goalieId)&&String(r.situation).toLowerCase()===situation.toLowerCase()&&(!team||String(r.team).toUpperCase()===String(team).toUpperCase()));
 if(matches.length!==1)return unavailable(matches.length?"ambiguous_goalie_row":"missing_goalie_row");
 const r=matches[0],xga=n(r.xGoals),ga=n(r.goals),shots=n(r.ongoal);
 if(![xga,ga,shots].every(Number.isFinite)||xga<0||ga<0||shots<0)return unavailable("missing_or_invalid_statistics");
 if(shots<minShots)return unavailable("insufficient_shots");
 const gsax=xga-ga;
 return {available:true,reason:null,experimental:true,value:{
  goalieId:String(goalieId),team:String(r.team||""),situation,
  gsax:Math.round(gsax*100)/100,
  gsaxPer100Shots:Math.round(gsax/shots*10000)/100,
  xGoalsAgainst:Math.round(xga*100)/100,
  goalsAgainst:ga,shotsAgainst:shots,
  fetchedAt,sourceType:"season_summary_snapshot",
  historicalSafeOnlyIfArchivedBeforeKickoff:true
 }};
}
return {goalieSnapshot};
});
