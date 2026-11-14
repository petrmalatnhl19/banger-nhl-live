"use strict";
/* CORE43-CAL-03: prospective, read-only multi-coefficient capture planner.
 * No network, DB writes, or automatic scheduling in this module.
 */
const crypto=require("node:crypto");
const {calculatePregameTwoGoalieShadow}=require("./core43_two_goalie_pregame_shadow.cjs");
const COEFFICIENTS=Object.freeze([0,0.005,0.02,0.03]);
const WINDOW=Object.freeze({minMinutes:45,maxMinutes:75});
const iso=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const fail=reason=>({ready:false,reason,production:false,writeEnabled:false});
function plan({payload,provenance,now,existing=[]}={}){
 if(!payload||!iso(now)||!iso(payload.predictionAt)||!iso(payload.kickoffAt))return fail("invalid_time");
 if(!Array.isArray(existing)||existing.some(x=>typeof x!=="string"))return fail("invalid_existing_keys");
 const ms=Date.parse(payload.kickoffAt)-Date.parse(now);
 if(ms<WINDOW.minMinutes*60000||ms>WINDOW.maxMinutes*60000)return fail("outside_60m_window");
 if(Date.parse(payload.predictionAt)>Date.parse(now)||Date.parse(now)-Date.parse(payload.predictionAt)>300000)return fail("stale_capture");
 if(!provenance||typeof provenance.gsaxArchiveId!=="string"||!provenance.gsaxArchiveId.trim()||provenance.baselineModel!=="core42")return fail("missing_provenance");
 if(!payload.baseline||!iso(payload.baseline.predictedAt)||Date.parse(payload.baseline.predictedAt)>Date.parse(payload.predictionAt))return fail("invalid_baseline");
 const outputs=[];
 for(const coefficient of COEFFICIENTS){
  const result=calculatePregameTwoGoalieShadow({...payload,coefficient});
  if(!result.available)return fail("variant_"+coefficient+"_"+result.reason);
  const record={schema:"core43_cal03_dryrun_v1",gameId:String(payload.gameId),awayTeam:payload.awayTeam,homeTeam:payload.homeTeam,
   kickoffAt:payload.kickoffAt,predictedAt:payload.predictionAt,frozenAt:now,inputAsOf:payload.predictionAt,
   baseline:result.baseline,goalies:result.goalies,gsaxFetchedAt:payload.gsaxFetchedAt,
   sourceArchiveId:provenance.gsaxArchiveId,coefficient,
   away:result.expectedAwayGoals,home:result.expectedHomeGoals,
   production:false,experimental:true,calibrated:false,persistable:false};
  const sha256=crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
  // Stable per game and fixed 60-minute window, even when the runner retries with a fresh predictionAt.
  const key=[record.gameId,record.schema,record.kickoffAt,"60m",String(coefficient)].join(":");
  outputs.push({key,sha256,record,duplicate:existing.includes(key)});
 }
 return {ready:true,mode:"read_only_dry_run",production:false,writeEnabled:false,
  windowMinutes:Math.round(ms/60000),variants:outputs,uniqueVariants:outputs.filter(v=>!v.duplicate).length};
}
module.exports={COEFFICIENTS,WINDOW,plan};
