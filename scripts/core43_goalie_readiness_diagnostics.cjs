"use strict";
/* Read-only, as-of goalie diagnostics. Never promotes a projection to verified evidence. */
const validTime = value => typeof value === "string" && Number.isFinite(Date.parse(value));
function diagnoseGoalies({gameId, awayTeam, homeTeam, asOf, observations=[], identities=[], starterEvidence=[]}={}) {
 if (!gameId || !validTime(asOf) || !/^[A-Z]{3}$/.test(awayTeam||"") || !/^[A-Z]{3}$/.test(homeTeam||"") || awayTeam===homeTeam) throw Error("invalid_diagnostic_context");
 const cutoff=Date.parse(asOf);
 const sides=[["away",awayTeam],["home",homeTeam]].map(([side,teamCode])=>{
  const history=observations.filter(o=>String(o.game_id)===String(gameId) && o.team_code===teamCode && validTime(o.observed_at) && validTime(o.source_snapshot_at) && Date.parse(o.source_snapshot_at)<=Date.parse(o.observed_at) && Date.parse(o.observed_at)<=cutoff);
  history.sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at));
  const latest=history[0]||null;
  const sameTime=latest?history.filter(o=>o.observed_at===latest.observed_at):[];
  const conflict=sameTime.some(o=>o.goalie_name!==latest.goalie_name || o.observed_status!==latest.observed_status);
  const validObservation=latest && !conflict && ["projected","confirmed"].includes(latest.observed_status);
  const evidence=starterEvidence.filter(e=>String(e.game_id)===String(gameId) && e.team_code===teamCode && validTime(e.source_published_at) && validTime(e.verified_at) && Date.parse(e.source_published_at)<=Date.parse(e.verified_at) && Date.parse(e.verified_at)<=cutoff && e.evidence_status==="confirmed");
  // Evidence must refer to the same goalie identity; never match by team alone.
  const matching=evidence.filter(e=>latest && identities.some(i=>i.team_code===teamCode && i.goalie_name===latest.goalie_name && String(i.goalie_id)===String(e.goalie_id) && validTime(i.observed_at) && Date.parse(i.observed_at)<=cutoff));
  return {side,teamCode,goalieName:validObservation?latest.goalie_name:null,observedStatus:validObservation?latest.observed_status:null,observedAt:validObservation?latest.observed_at:null,verifiedEvidence:matching.length>0,reason:!latest?"missing_pregame_observation":conflict?"conflicting_latest_observations":!validObservation?"invalid_latest_status":!matching.length?"missing_matching_verified_starter_evidence":null};
 });
 return {gameId:String(gameId),asOf,mode:"read_only",sides,verifiedBoth:sides.every(s=>s.verifiedEvidence),writes:0};
}
module.exports={diagnoseGoalies};
