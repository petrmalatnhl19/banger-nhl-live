'use strict';
// LINEUPS-03.34: conservative goal/penalty interaction flags.
// A power-play goal may terminate a minor, but cannot be inferred from
// the scoring team alone without an independently verified strength clock.
function auditGoalPenaltyInteractions(plays,penaltyEvidence,awayId,homeId){
 const empty={status:'unverified',interactions:[],verified:false,publishable:false};
 if(!Array.isArray(plays)||penaltyEvidence?.status!=='penalty-context-only'||!Array.isArray(penaltyEvidence.penalties)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const goals=[];
 for(const p of plays){
  if(p?.typeDescKey!=='goal')continue;
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,teamId=p?.details?.eventOwnerTeamId;
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||![awayId,homeId].includes(teamId))continue;
  const [m,s]=clock.split(':').map(Number);if(m>19||s>59)continue;
  goals.push({eventId:p.eventId??null,second:(period-1)*1200+m*60+s,teamId});
 }
 const interactions=[];
 for(const penalty of penaltyEvidence.penalties){
  if(![awayId,homeId].includes(penalty.teamId)||penalty.minutes!==2||!Number.isInteger(penalty.second))continue;
  for(const goal of goals){
   if(goal.second<penalty.second||goal.second>=penalty.second+120)continue;
   interactions.push({penaltyEventId:penalty.eventId,goalEventId:goal.eventId,goalSecond:goal.second,scoringTeamId:goal.teamId,penalizedTeamId:penalty.teamId,flag:goal.teamId!==penalty.teamId?'possible-minor-termination':'shorthanded-goal-context',verifiedTermination:false});
  }
 }
 return {status:'goal-penalty-context',goalCount:goals.length,interactions,verified:false,publishable:false,reason:'A goal within nominal penalty time is not proof of a PP goal or penalty termination; verify on-ice strength and concurrent penalties first.'};
}
module.exports={auditGoalPenaltyInteractions};
