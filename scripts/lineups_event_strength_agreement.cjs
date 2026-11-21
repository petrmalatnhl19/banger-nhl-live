'use strict';
// LINEUPS-03.15: compare independently reported situation code with skater shifts
// ONLY at event timestamps. No interpolation, no confirmed continuous strength.
function auditEventStrengthAgreement(plays,shifts,awayId,homeId){
 const base={status:'unverified',checked:0,matched:0,mismatched:0,skipped:0,examples:[],verifiedStrengthWindows:false};
 if(!Array.isArray(plays)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return base;
 const seen=new Set(),valid=[];
 for(const s of shifts){
  if(![awayId,homeId].includes(s?.teamId))continue;
  if(!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start)return {...base,reason:'invalid-shifts'};
  const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(seen.has(key))return {...base,reason:'duplicate-shifts'};seen.add(key);valid.push(s);
 }
 const result={...base,examples:[]};
 for(const p of plays){
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,code=String(p?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code)){result.skipped++;continue}
  const [mm,ss]=clock.split(':').map(Number),t=(period-1)*1200+mm*60+ss;
  if(mm>19||ss>59||t>=3600){result.skipped++;continue}
  const counts=[awayId,homeId].map(id=>new Set(valid.filter(s=>s.teamId===id&&s.start<=t&&t<s.end).map(s=>s.playerId)).size);
  const expected=[Number(code[1]),Number(code[2])];
  const matched=counts.every((n,i)=>n===expected[i]);
  result.checked++;if(matched)result.matched++;else result.mismatched++;
  if(result.examples.length<12)result.examples.push({period,timeInPeriod:clock,code,observed:counts,expected,matched});
 }
 result.status=result.checked?'point-comparison-only':'unverified';
 result.reason='Shift timestamps and event situation codes are compared only at sampled events; this cannot certify intervals or PP/PK units.';
 return result;
}
module.exports={auditEventStrengthAgreement};
