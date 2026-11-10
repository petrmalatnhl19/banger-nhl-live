/* Read-only historical RotoWire projection -> official NHL starter comparison.
 * No database writes; observation time is NOT publication time.
 * Picks use latest frozen observation before each lead-time boundary.
 */
"use strict";
const stamp=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const normalize=x=>typeof x==="string"?x.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z]/g,"").toLowerCase():"";
const windows=[["under_2h",0,2],["2_to_6h",2,6],["6_to_24h",6,24],["over_24h",24,Infinity]];
function compareHistoricalProjections({observations=[],schedules=[],officialGames=[],identityMap=[],minSample=30}={}){
 if(![observations,schedules,officialGames,identityMap].every(Array.isArray)||!Number.isSafeInteger(minSample)||minSample<30)throw new TypeError("Invalid audit inputs");
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
 const mapped=new Map(),ambiguous=new Set();
 for(const m of identityMap){
  if(!m||typeof m.team_code!=="string"||!normalize(m.goalie_name)||!/^\d+$/.test(String(m.goalie_id)))continue;
  const key=m.team_code+"|"+normalize(m.goalie_name),id=String(m.goalie_id);
  if(mapped.has(key)&&mapped.get(key)!==id)ambiguous.add(key);
  else mapped.set(key,id);
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
  if(o.goalie_name.trim().split(/\s+/).length<2||actual.name.trim().split(/\s+/).length<2){skip("ambiguous_name");continue;}
  const mapKey=o.team_code+"|"+identity;
  const projectedId=!ambiguous.has(mapKey)?mapped.get(mapKey):null;
  const group=key+"|"+bucket,previous=candidates.get(group);
  if(previous&&stamp(previous.observedAt)===captured&&previous.projectedNameKey!==identity){conflicts.add(group);continue;}
  if(!previous||captured>stamp(previous.observedAt)){
   candidates.set(group,{gameId:o.game_id,teamCode:o.team_code,kickoffAt:schedule.kickoff_at,
    observedAt:new Date(captured).toISOString(),projectedNameKey:identity,
    actualNameKey:actualIdentity,officialStarterId:actual.id,projectedGoalieId:projectedId||null,
    nameMatch:identity===actualIdentity,idMatch:projectedId?projectedId===actual.id:null});
  }
 }
 const rows=[...candidates.entries()].filter(([key])=>!conflicts.has(key)).map(([,r])=>r);
 const counts={};const mismatchSamples=[];
 for(const r of rows){const lead=(stamp(r.kickoffAt)-stamp(r.observedAt))/3600000;const bucket=windows.find(([,a,b])=>lead>=a&&lead<b)?.[0];
  const entry=counts[bucket]||(counts[bucket]={compared:0,nameMatches:0,observedMatchRate:null,idCompared:0,idMatches:0,idMatchRate:null,usableAsProbability:false});
  entry.compared++;if(r.nameMatch)entry.nameMatches++;if(r.idMatch!==null){entry.idCompared++;if(r.idMatch)entry.idMatches++;}if(!r.nameMatch&&mismatchSamples.length<8)mismatchSamples.push({gameId:r.gameId,teamCode:r.teamCode,projectedNameKey:r.projectedNameKey,officialNameKey:r.actualNameKey,projectedGoalieId:r.projectedGoalieId,officialStarterId:r.officialStarterId});
 }
 for(const entry of Object.values(counts)){if(entry.compared>=minSample)entry.observedMatchRate=entry.nameMatches/entry.compared;if(entry.idCompared>=minSample)entry.idMatchRate=entry.idMatches/entry.idCompared;}
 return {mode:"read_only",production:false,persistable:false,rowsCompared:rows.length,
  conflicts:conflicts.size,excluded,countsByLeadTime:counts,mismatchSamples,identityMapEntries:identityMap.length,
  calibrated:false,warning:"Identity-map matches are retrospective checks, not proof of historical roster membership. No inferred goalie IDs, invented verification timestamps, or calibrated probabilities."};
}
module.exports={compareHistoricalProjections};
