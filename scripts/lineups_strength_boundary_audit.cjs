'use strict';
// LINEUPS-03.16: investigate mismatches at event boundaries without altering evidence.
function auditStrengthBoundaryMismatches(plays,shifts,awayId,homeId){
 const base={status:'unverified',checked:0,mismatches:0,nearShiftBoundary:0,awayFromBoundary:0,skipped:0,examples:[],verifiedStrengthWindows:false};
 if(!Array.isArray(plays)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return base;
 const relevant=shifts.filter(s=>s&&[awayId,homeId].includes(s.teamId));
 if(relevant.some(s=>!Number.isInteger(s.start)||!Number.isInteger(s.end)||!Number.isInteger(s.playerId)||s.start<0||s.end<=s.start||s.end>3600))return {...base,reason:'invalid-shifts'};
 const boundaries=new Set(relevant.flatMap(s=>[s.start,s.end]));
 const result={...base};
 for(const p of plays){
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,code=String(p?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code)){result.skipped++;continue}
  const [mm,ss]=clock.split(':').map(Number),t=(period-1)*1200+mm*60+ss;
  if(mm>19||ss>59||t>=3600){result.skipped++;continue}
  const observed=[awayId,homeId].map(id=>new Set(relevant.filter(s=>s.teamId===id&&s.start<=t&&t<s.end).map(s=>s.playerId)).size);
  const expected=[Number(code[1]),Number(code[2])];
  result.checked++;
  if(observed[0]===expected[0]&&observed[1]===expected[1])continue;
  result.mismatches++;
  const near=[t-1,t,t+1].some(time=>boundaries.has(time));
  if(near)result.nearShiftBoundary++;else result.awayFromBoundary++;
  if(result.examples.length<20)result.examples.push({period,timeInPeriod:clock,situationCode:code,observed,expected,nearShiftBoundary:near,typeDescKey:p.typeDescKey??null});
 }
 result.status=result.checked?'diagnostic-only':'unverified';
 result.reason='Boundary proximity is a possible explanation, not proof of event or shift timing error.';
 return result;
}
module.exports={auditStrengthBoundaryMismatches};
