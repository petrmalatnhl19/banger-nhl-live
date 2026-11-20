'use strict';
// LINEUPS-03.28: compare independently recorded penalty events to candidate
// strength windows. This is an evidence audit, NOT a penalty-clock simulator.
function auditPenaltyEvidence(plays,windows,awayId,homeId){
 const empty={status:'unverified',penalties:[],candidateWindows:0,verifiedStrengthWindows:false,verifiedUnits:false,publishable:false};
 if(!Array.isArray(plays)||!Array.isArray(windows)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const penalties=[];
 for(const p of plays){
  if(p?.typeDescKey!=='penalty')continue;
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,details=p?.details||{};
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock))continue;
  const [m,s]=clock.split(':').map(Number);if(m>19||s>59)continue;
  const t=(period-1)*1200+m*60+s,teamId=details.eventOwnerTeamId;
  const minutes=details.duration??details.penaltyMinutes;
  const type=details.typeCode??details.penaltyTypeCode??null;
  const candidateWindows=windows.filter(w=>Number.isInteger(w.startSecond)&&Number.isInteger(w.endSecondExclusive)&&w.startSecond>=t&&w.startSecond<t+300&&/^\d+v\d+$/.test(w.strength)).map(w=>({strength:w.strength,startSecond:w.startSecond,seconds:w.endSecondExclusive-w.startSecond}));
  penalties.push({eventId:p.eventId??null,second:t,teamId:Number.isInteger(teamId)?teamId:null,minutes:Number.isInteger(minutes)?minutes:null,type,nearbyCandidateWindows:candidateWindows.slice(0,15),classification:'context-only'});
 }
 return {status:'penalty-context-only',penalties,candidateWindows:windows.length,verifiedStrengthWindows:false,verifiedUnits:false,publishable:false,reason:'Penalties alone cannot prove PP windows: coincidental penalties, delayed calls, major penalties, goals ending minors and offsetting penalties require separate validation.'};
}
module.exports={auditPenaltyEvidence};
