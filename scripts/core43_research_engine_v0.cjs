"use strict";
/* CORE 4.3 deterministic research engine v0.
 * All inputs must be observed as-of calculation time; no DB or network access.
 * Coefficients are provisional and UNCALIBRATED. Never persist as a real forecast.
 */
const VERSION="core43_research_v0_uncalibrated";
const WEIGHTS=Object.freeze({shotShare:1.6,xgShare:1.8,ppRate:0.35,pkRate:0.30,restDays:0.035,goalieGSAx60:0.07});
function numeric(v,name,min,max){
 if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)throw Error("invalid_"+name);
 return v;
}
function stamp(v,name){
 if(typeof v!=="string"||!Number.isFinite(Date.parse(v))||!/(Z|[+-]\d\d:\d\d)$/.test(v))throw Error("invalid_"+name);
 return Date.parse(v);
}
function computeCore43({gameId,awayTeam,homeTeam,kickoffAt,asOf,inputs}={}){
 if(gameId==null||!String(gameId)||!awayTeam||!homeTeam||awayTeam===homeTeam)throw Error("invalid_game_identity");
 const cutoff=stamp(kickoffAt,"kickoff"),now=stamp(asOf,"asof");
 if(now>=cutoff)throw Error("not_pregame");
 if(!inputs||typeof inputs!=="object")throw Error("missing_inputs");
 const baseline=inputs.baseline;
 if(!baseline||typeof baseline!=="object")throw Error("missing_baseline");
 const a=numeric(baseline.awayGoals,"baseline_away",0,10);
 const h=numeric(baseline.homeGoals,"baseline_home",0,10);
 if(stamp(baseline.observedAt,"baseline_observed")>now)throw Error("future_baseline");
 if(baseline.gameId!=null&&String(baseline.gameId)!==String(gameId))throw Error("baseline_game_mismatch");
 const teams={away:inputs.away,home:inputs.home};
 for(const [side,t] of Object.entries(teams)){
  if(!t||typeof t!=="object")throw Error("missing_"+side+"_inputs");
  if(stamp(t.observedAt,side+"_observed")>now)throw Error("future_"+side+"_inputs");
  numeric(t.shotShare,side+"_shot_share",0,1);
  numeric(t.xgShare,side+"_xg_share",0,1);
  numeric(t.ppRate,side+"_pp_rate",0,1);
  numeric(t.pkRate,side+"_pk_rate",0,1);
  numeric(t.restDays,side+"_rest_days",0,10);
  numeric(t.goalieGSAx60,side+"_goalie_gsax60",-5,5);
 }
 const A=teams.away,H=teams.home;
 // Zero-centered adjustments; home-vs-away symmetry is intentional.
 function adjustment(off,def){
  return WEIGHTS.shotShare*(off.shotShare-0.5)+WEIGHTS.xgShare*(off.xgShare-0.5)
   +WEIGHTS.ppRate*(off.ppRate-0.2)-WEIGHTS.pkRate*(def.pkRate-0.8)
   +WEIGHTS.restDays*(off.restDays-def.restDays)-WEIGHTS.goalieGSAx60*def.goalieGSAx60;
 }
 const clamp=x=>Math.max(0,Math.min(10,Number(x.toFixed(4))));
 const expectedAwayGoals=clamp(a+adjustment(A,H));
 const expectedHomeGoals=clamp(h+adjustment(H,A));
 return Object.freeze({gameId:String(gameId),model:"core43",engineVersion:VERSION,
  computedAt:asOf,production:false,calibrated:false,persistable:false,
  expectedAwayGoals,expectedHomeGoals,
  inputSnapshot:{asOf,gameId:String(gameId),kickoffAt,baseline,away:A,home:H,weights:WEIGHTS,
   calibrated:false,persistable:false,method:"deterministic_research_baseline"}});
}
module.exports={computeCore43,VERSION};
