'use strict';
// LINEUPS-03.18: compare event situation counts against skater shifts at t-1,t,t+1.
// This is diagnostic only: no automatic timestamp correction or verified PP/PK.
function auditBoundaryAlternatives(plays,shifts,awayId,homeId){
 const base={status:'unverified',mismatches:0,previousSecondMatches:0,nextSecondMatches:0,bothMatch:0,neitherMatches:0,examples:[],verifiedStrengthWindows:false};
 if(!Array.isArray(plays)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return base;
 const relevant=shifts.filter(s=>s&&[awayId,homeId].includes(s.teamId));
 if(relevant.some(s=>!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start))return {...base,reason:'invalid-shifts'};
 const countAt=t=>[awayId,homeId].map(id=>new Set(relevant.filter(s=>s.teamId===id&&s.start<=t&&t<s.end).map(s=>s.playerId)).size);
 const equal=(a,b)=>a.every((v,i)=>v===b[i]);
 const result={...base};
 for(const p of plays){
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,code=String(p?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code))continue;
  const [mm,ss]=clock.split(':').map(Number),t=(period-1)*1200+mm*60+ss;
  if(mm>19||ss>59||t>=3600)continue;
  const expected=[Number(code[1]),Number(code[2])];
  if(equal(countAt(t),expected))continue;
  const prev=t>0&&t%1200!==0&&equal(countAt(t-1),expected);
  const next=t<3599&&t%1200!==1199&&equal(countAt(t+1),expected);
  result.mismatches++;
  if(prev)result.previousSecondMatches++;
  if(next)result.nextSecondMatches++;
  if(prev&&next)result.bothMatch++;
  if(!prev&&!next)result.neitherMatches++;
  if(result.examples.length<20)result.examples.push({period,timeInPeriod:clock,typeDescKey:p.typeDescKey??null,code,previousSecondMatches:prev,nextSecondMatches:next});
 }
 result.status='diagnostic-only';
 result.reason='Adjacent-second matches do not establish event ordering, strength intervals or valid lineup units.';
 return result;
}
module.exports={auditBoundaryAlternatives};
