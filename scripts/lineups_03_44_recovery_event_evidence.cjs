'use strict';
// LINEUPS-03.44: inspect NHL event strength codes inside candidate recovery windows.
// Event point agreement cannot verify uninterrupted 5v5 strength.
function auditRecoveryEventEvidence({recoveryCandidates,plays}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false,windows:[]});
 if(!Array.isArray(recoveryCandidates)||!Array.isArray(plays))return fail('missing-input');
 const events=[];
 for(const play of plays){
  const period=play?.periodDescriptor?.number,clock=play?.timeInPeriod,code=String(play?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code))continue;
  const [m,s]=clock.split(':').map(Number);if(m>=20||s>=60)continue;
  events.push({second:(period-1)*1200+m*60+s,code,strength:code[1]+'v'+code[2]});
 }
 events.sort((a,b)=>a.second-b.second);
 const windows=[];
 for(const w of recoveryCandidates){
  if(!w||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond)return fail('invalid-window');
  const inside=events.filter(e=>e.second>=w.startSecond&&e.second<w.endSecondExclusive);
  const before=events.filter(e=>e.second<w.startSecond).at(-1);
  const after=events.find(e=>e.second>=w.endSecondExclusive);
  const strengthCounts={};for(const e of inside)strengthCounts[e.strength]=(strengthCounts[e.strength]||0)+1;
  const conflictingEvents=inside.filter(e=>e.strength!=='5v5').length;
  const pointSupport=inside.filter(e=>e.strength==='5v5').length;
  windows.push({startSecond:w.startSecond,endSecondExclusive:w.endSecondExclusive,seconds:w.endSecondExclusive-w.startSecond,eventCount:inside.length,pointSupport,conflictingEvents,strengthCounts,precedingEvent:before??null,followingEvent:after??null,status:conflictingEvents?'conflicting-event-evidence':pointSupport?'point-support-only':'no-events-inside',verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',windows,verifiedStrength:false,publishable:false,note:'NHL situation codes at event timestamps are point evidence only; gaps are never promoted to verified intervals.'};
}
module.exports={auditRecoveryEventEvidence};
