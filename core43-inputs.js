/* BANGER CORE 4.3 experimental inputs — no production prediction changes.
   Pure functions. Missing data is null, never zero. All games must be strictly before kickoff. */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.BangerCore43Inputs=api;
})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const iso=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function fatigue(games,kickoff,opts={}){
  const start=iso(kickoff);
  if(!Number.isFinite(start)||!Array.isArray(games))return {available:false,reason:"invalid_schedule",value:null};
  // completed games must have both a known start and an end prior to prediction kickoff
  const past=games.filter(g=>g&&["OFF","FINAL"].includes(g.state)&&finite(iso(g.startTimeUTC))&&finite(iso(g.endTimeUTC))&&iso(g.endTimeUTC)<start&&iso(g.startTimeUTC)<start).sort((a,b)=>iso(b.endTimeUTC)-iso(a.endTimeUTC));
  if(!past.length)return {available:false,reason:"no_verified_prior_game",value:null};
  const hours=(start-iso(past[0].endTimeUTC))/3600000;
  const last7=past.filter(g=>(start-iso(g.endTimeUTC))<=7*86400000).length;
  const last14=past.filter(g=>(start-iso(g.endTimeUTC))<=14*86400000).length;
  const backToBack=hours<30;
  // descriptive burden score only; NOT a calibrated goal adjustment
  const burden=clamp((backToBack?2:0)+(hours<48?1:0)+Math.max(0,last7-3)*0.5,0,5);
  return {available:true,reason:null,value:{restHours:Math.round(hours*10)/10,backToBack,gamesLast7:last7,gamesLast14:last14,burdenScore:burden},sampleGames:past.length,experimental:true};
}
function gsax(input){
  if(!input||!finite(input.expectedGoalsAgainst)||!finite(input.goalsAgainst)||input.expectedGoalsAgainst<0||input.goalsAgainst<0)return {available:false,reason:"missing_xga_or_ga",value:null};
  if(!finite(input.shotsAgainst)||input.shotsAgainst<30)return {available:false,reason:"insufficient_shots",value:null};
  const total=input.expectedGoalsAgainst-input.goalsAgainst;
  return {available:true,reason:null,value:{gsax:Math.round(total*100)/100,gsaxPer100Shots:Math.round(total/input.shotsAgainst*10000)/100,shotsAgainst:input.shotsAgainst},experimental:true};
}
function absences(roster,missing,asOf){
  const time=iso(asOf);
  if(!Array.isArray(roster)||!Array.isArray(missing)||!Number.isFinite(time))return {available:false,reason:"missing_roster_or_status",value:null};
  const ids=new Set(roster.filter(p=>p&&p.id!=null).map(p=>String(p.id)));
  if(!ids.size)return {available:false,reason:"empty_roster",value:null};
  const valid=missing.filter(p=>p&&ids.has(String(p.id))&&finite(iso(p.verifiedAt))&&iso(p.verifiedAt)<=time&&p.status==="out");
  // Never treat an unknown player as absent; never invent player importance.
  return {available:true,reason:null,value:{verifiedOutCount:new Set(valid.map(p=>String(p.id))).size,verifiedPlayerIds:[...new Set(valid.map(p=>String(p.id)))]},coverage:{rosterCount:ids.size,providedStatuses:missing.length},experimental:true};
}

// NHL club-schedule-season contains game start times but not reliable end times.
// Calculate start-to-start spacing separately; do NOT label it as exact rest hours.
function nhlScheduleFatigue(games,kickoff,team){
 const start=iso(kickoff),code=String(team||"").toUpperCase();
 if(!Number.isFinite(start)||!Array.isArray(games)||!/^[A-Z]{3}$/.test(code))
   return {available:false,reason:"invalid_schedule_or_team",value:null};
 const past=games.filter(g=>g&&["OFF","FINAL"].includes(String(g.gameState))&&
   Number.isFinite(iso(g.startTimeUTC))&&iso(g.startTimeUTC)<start&&
   (String(g.homeTeam?.abbrev)===code||String(g.awayTeam?.abbrev)===code)&&
   Number.isFinite(Number(g.homeTeam?.score))&&Number.isFinite(Number(g.awayTeam?.score)))
   .sort((a,b)=>iso(b.startTimeUTC)-iso(a.startTimeUTC));
 if(!past.length)return {available:false,reason:"no_completed_prior_games",value:null};
 const spacing=(start-iso(past[0].startTimeUTC))/3600000;
 const gamesLast7=past.filter(g=>start-iso(g.startTimeUTC)<=7*86400000).length;
 const gamesLast14=past.filter(g=>start-iso(g.startTimeUTC)<=14*86400000).length;
 return {available:true,reason:null,experimental:true,value:{
   hoursBetweenStarts:Math.round(spacing*10)/10,
   consecutiveCalendarDays:spacing<36,
   gamesLast7,gamesLast14,
   metric:"start_to_start_not_actual_rest",
   exactRestHours:null
 },sampleGames:past.length};
}

function core43Inputs({kickoff,teamGames,goalieData,roster,missing}={}){
 return {version:"core43-inputs-v0.1",production:false,fatigue:fatigue(teamGames,kickoff),gsax:gsax(goalieData),absences:absences(roster,missing,kickoff)};
}
return {fatigue,nhlScheduleFatigue,gsax,absences,core43Inputs};
});
