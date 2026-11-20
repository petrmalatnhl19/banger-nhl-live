'use strict';
// LINEUPS-03.19: evidence at event instants, not continuous PP/PK windows.
// The prior second is an alternative ONLY when the event instant mismatches.
function eventStrengthEvidence(plays,shifts,awayId,homeId){
 const base={status:'unverified',events:0,directMatches:0,previousSecondOnly:0,ambiguous:0,unresolved:0,skipped:0,byStrength:{},verifiedStrengthWindows:false,verifiedUnits:false};
 if(!Array.isArray(plays)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return base;
 const relevant=shifts.filter(s=>s&&[awayId,homeId].includes(s.teamId));
 if(relevant.some(s=>!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start))return {...base,reason:'invalid-shifts'};
 const unique=new Set();
 for(const s of relevant){const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(unique.has(key))return {...base,reason:'duplicate-shifts'};unique.add(key)}
 const counts=t=>[awayId,homeId].map(id=>new Set(relevant.filter(s=>s.teamId===id&&s.start<=t&&t<s.end).map(s=>s.playerId)).size);
 const equal=(a,b)=>a.every((n,i)=>n===b[i]);
 const result={...base};
 for(const p of plays){
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,code=String(p?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code)){result.skipped++;continue}
  const [mm,ss]=clock.split(':').map(Number),t=(period-1)*1200+mm*60+ss;
  if(mm>19||ss>59||t>=3600){result.skipped++;continue}
  const expected=[Number(code[1]),Number(code[2])],now=equal(counts(t),expected);
  const previous=t%1200>0&&equal(counts(t-1),expected);
  result.events++;
  const label=expected.join('v');
  if(!result.byStrength[label])result.byStrength[label]={direct:0,previousOnly:0,ambiguous:0,unresolved:0};
  if(now){result.directMatches++;result.byStrength[label].direct++}
  else if(previous){result.previousSecondOnly++;result.byStrength[label].previousOnly++}
  else {result.unresolved++;result.byStrength[label].unresolved++}
  // Multiple plays at the same clock tick are still separate evidence records, not independent intervals.
 }
 result.status=result.events?'event-evidence-only':'unverified';
 result.reason='Direct matches and previous-second alternatives are point evidence only; no inferred time windows, PP/PK units or universal time shift.';
 return result;
}
module.exports={eventStrengthEvidence};
