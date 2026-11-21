'use strict';
// LINEUPS-03.53: event-time transition audit, not a continuous-strength oracle.
function auditRecoveryEventTransitions({segmentAudit,plays}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(segmentAudit?.status!=='candidate-only'||!Array.isArray(segmentAudit.segments)||!Array.isArray(plays))return fail('invalid-input');
 const events=[];
 for(const play of plays){
  const period=play?.periodDescriptor?.number,clock=play?.timeInPeriod,code=String(play?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^[01][0-6][0-6][01]$/.test(code))continue;
  const [m,s]=clock.split(':').map(Number);if(m>=20||s>=60)continue;
  events.push({second:(period-1)*1200+m*60+s,strength:code[1]+'v'+code[2],code});
 }
 events.sort((a,b)=>a.second-b.second);
 const segments=[];
 for(const w of segmentAudit.segments){
  if(!Number.isInteger(w?.startSecond)||!Number.isInteger(w?.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond||Math.floor(w.startSecond/1200)!==Math.floor((w.endSecondExclusive-1)/1200))return fail('invalid-segment');
  const inside=events.filter(e=>e.second>=w.startSecond&&e.second<w.endSecondExclusive);
  const timestamps=[...new Set(inside.map(e=>e.second))];
  const conflictSeconds=[...new Set(inside.filter(e=>e.strength!=='5v5').map(e=>e.second))];
  const contradictoryTimestampCount=timestamps.filter(t=>new Set(inside.filter(e=>e.second===t).map(e=>e.strength)).size>1).length;
  const first=inside[0]?.strength??null,last=inside.at(-1)?.strength??null;
  let transitions=0;for(let i=1;i<inside.length;i++)if(inside[i].strength!==inside[i-1].strength)transitions++;
  segments.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.endSecondExclusive-w.startSecond,eventCount:inside.length,distinctEventSeconds:timestamps.length,conflictingEventSeconds:conflictSeconds.length,contradictoryTimestampCount,observedTransitions:transitions,firstEventStrength:first,lastEventStrength:last,classification:conflictSeconds.length||contradictoryTimestampCount?'event-conflict-review':inside.length?'event-points-only':'no-event-points',verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',segments,verifiedStrength:false,publishable:false,note:'No event points can establish uninterrupted strength between timestamps; do not promote any interval.'};
}
module.exports={auditRecoveryEventTransitions};
