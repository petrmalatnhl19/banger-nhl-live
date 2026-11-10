/* Read-only historical RotoWire projection -> official NHL starter comparison.
 * No database writes; observation time is NOT publication time.
 * Picks use latest frozen observation before each lead-time boundary.
 */
"use strict";
const {evaluateProjectedReliability}=require("./core43_projected_reliability_audit.cjs");
const stamp=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const normalize=x=>typeof x==="string"?x.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z]/g,"").toLowerCase():"";
const windows=[["under_2h",0,2],["2_to_6h",2,6],["6_to_24h",6,24],["over_24h",24,Infinity]];
function compareHistoricalProjections({observations=[],schedules=[],officialGames=[],minSample=30}={}){
 if(![observations,schedules,officialGames].every(Array.isArray))throw new TypeError("Expected arrays");
 const excluded={};const skip=r=>{excluded[r]=(excluded[r]||0)+1;};
 const scheduleById=new Map(),badSchedule=new Set();
 for(const s of schedules){
  if(!s||!Number.isFinite(stamp(s.kickoff_at)))continue;
  const key=String(s.game_id),old=scheduleById.get(key);
  if(old&&(old.kickoff_at!==s.kickoff_at||old.away_team!==s.away_team||old.home_team!==s.home_team))badSchedule.add(key);
  else scheduleById.set(key,s);
 }
 const official=new Map(),badOfficial=new Set();
 for(const g of officialGames){
  if(!g||!g.away||!g.home)continue;
  for(const side of ["away","home"]){
   const x=g[side],id=x?.startingGoalieId;
   if(!x?.starterVerified||!Number.isSafeInteger(id)||id<=0||typeof x.team!=="string")continue;
   const key=String(g.gameId)+"|"+x.team;
   if(official.has(key))badOfficial.add(key);
   official.set(key,{id:String(id),name:x.participants?.find(p=>p.playerId===id)?.name||""});
  }
 }
 const candidates=new Map(),conflicts=new Set();
 for(const o of observations){
  if(!o||o.observed_status!=="projected"){skip("not_projected");continue;}
  const gameId=String(o.game_id),schedule=scheduleById.get(gameId);
  if(!schedule||badSchedule.has(gameId)){skip("missing_or_conflicting_schedule");continue;}
  if(o.team_code!==schedule.away_team&&o.team_code!==schedule.home_team){skip("team_mismatch");continue;}
  const kickoff=stamp(schedule.kickoff_at),observed=stamp(o.source_snapshot_at),captured=stamp(o.observed_at);
  if(![kickoff,observed,captured].every(Number.isFinite)||observed>captured||captured>=kickoff){skip("not_frozen_pregame");continue;}
  const hours=(kickoff-captured)/3600000;
  const bucket=windows.find(([,min,max])=>hours>=min&&hours<max)?.[0];
  if(!bucket){skip("invalid_lead_time");continue;}
  const key=gameId+"|"+o.team_code,actual=official.get(key);
  if(!actual||badOfficial.has(key)){skip("missing_verified_official_starter");continue;}
  if(!normalize(o.goalie_name)||!normalize(actual.name)){skip("missing_goalie_name");continue;}
  const identity=normalize(o.goalie_name),actualIdentity=normalize(actual.name);
  // Names can collide. Never claim identity proof solely from a normalized name.
  if(identity===actualIdentity&&o.goalie_name.trim().split(/\s+/).length<2){skip("ambiguous_name");continue;}
  const group=key+"|"+bucket,previous=candidates.get(group);
  if(previous&&stamp(previous.predictedAt)===captured&&previous.predictedGoalieId!==identity){conflicts.add(group);continue;}
  if(!previous||captured>stamp(previous.predictedAt)){
   candidates.set(group,{gameId:o.game_id,teamCode:o.team_code,kickoffAt:schedule.kickoff_at,
    predictedAt:new Date(captured).toISOString(),actualVerifiedAt:new Date(Math.max(kickoff+1,Date.now())).toISOString(),
    predictedGoalieId:identity,actualStarterGoalieId:actualIdentity,
    actualSourceStatus:"verified",predictionStatus:"projected"});
  }
 }
 const rows=[...candidates.entries()].filter(([key])=>!conflicts.has(key)).map(([,r])=>r);
 const counts={};
 for(const r of rows){const lead=(stamp(r.kickoffAt)-stamp(r.predictedAt))/3600000;const bucket=windows.find(([,a,b])=>lead>=a&&lead<b)?.[0];counts[bucket]=(counts[bucket]||0)+1;}
 return {mode:"read_only",production:false,persistable:false,rowsEvaluated:rows.length,
  conflicts:conflicts.size,excluded,countsByLeadTime:counts,
  // Historical matching by full name is provisional, not sufficient for calibrated probabilities.
  reliability:evaluateProjectedReliability(rows,{minSample}),
  warning:"Provisional name-matched audit. Require independently verified goalie IDs and out-of-sample validation before calibration."};
}
module.exports={compareHistoricalProjections};
