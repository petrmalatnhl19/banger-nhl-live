'use strict';
// LINEUPS-03.54: measure event sampling gaps without inferring interval strength.
function auditRecoveryEventGaps({segmentAudit,plays}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(segmentAudit?.status!=='candidate-only'||!Array.isArray(segmentAudit.segments)||!Array.isArray(plays))return fail('invalid-input');
 const events=[];
 for(const play of plays){
  const period=play?.periodDescriptor?.number,clock=play?.timeInPeriod,code=String(play?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code))continue;
  const [m,s]=clock.split(':').map(Number);if(m>=20||s>=60)continue;
  events.push({second:(period-1)*1200+m*60+s,strength:code[1]+'v'+code[2]});
 }
 const segments=[];
 for(const w of segmentAudit.segments){
  if(!Number.isInteger(w?.startSecond)||!Number.isInteger(w?.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond||Math.floor(w.startSecond/1200)!==Math.floor((w.endSecondExclusive-1)/1200))return fail('invalid-segment');
  const points=[...new Set(events.filter(e=>e.second>=w.startSecond&&e.second<w.endSecondExclusive&&e.strength==='5v5').map(e=>e.second))].sort((a,b)=>a-b);
  const edges=[w.startSecond,...points,w.endSecondExclusive];
  const gaps=[];for(let i=1;i<edges.length;i++)gaps.push(edges[i]-edges[i-1]);
  segments.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.endSecondExclusive-w.startSecond,distinctFiveOnFiveEventSeconds:points.length,longestUnobservedSpanSeconds:Math.max(...gaps),eventTimeGapsSeconds:gaps,verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',segments,verifiedStrength:false,publishable:false,note:'Distances between event timestamps are sampling gaps, not verified game-state durations.'};
}
module.exports={auditRecoveryEventGaps};
