'use strict';
// LINEUPS-03.20: candidate intervals between consecutive NHL events.
// Event codes alone cannot verify continuous game strength. Every second must
// match shift-chart skater counts; results remain candidate-only.
function candidateStrengthIntervals(plays,shifts,awayId,homeId){
 const empty={status:'unverified',candidates:[],totalSeconds:0,verifiedStrengthWindows:false,verifiedUnits:false};
 if(!Array.isArray(plays)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return empty;
 const relevant=shifts.filter(s=>s&&[awayId,homeId].includes(s.teamId));
 if(relevant.some(s=>!Number.isInteger(s.start)||!Number.isInteger(s.end)||!Number.isInteger(s.playerId)||s.start<0||s.end>3600||s.end<=s.start))return {...empty,reason:'invalid-shifts'};
 const seen=new Set();
 for(const s of relevant){const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(seen.has(key))return {...empty,reason:'duplicate-shifts'};seen.add(key)}
 const events=[];
 for(const p of plays){
  const period=p?.periodDescriptor?.number,clock=p?.timeInPeriod,code=String(p?.situationCode??'');
  if(!Number.isInteger(period)||period<1||period>3||typeof clock!=='string'||!/^\d{2}:\d{2}$/.test(clock)||!/^\d{4}$/.test(code))continue;
  const [m,s]=clock.split(':').map(Number);if(m>19||s>59)continue;
  events.push({t:(period-1)*1200+m*60,period,code});
  events[events.length-1].t+=s;
 }
 events.sort((a,b)=>a.t-b.t);
 const counts=t=>[awayId,homeId].map(id=>new Set(relevant.filter(s=>s.teamId===id&&s.start<=t&&t<s.end).map(s=>s.playerId)).size);
 const candidates=[];
 for(let i=0;i<events.length-1;i++){
  const a=events[i],b=events[i+1];
  if(a.period!==b.period||a.code!==b.code||b.t<=a.t||b.t-a.t>120)continue;
  const expected=[Number(a.code[1]),Number(a.code[2])];
  // Exclude the event timestamps: they can encode before/after states.
  const start=a.t+1,end=b.t;
  if(end<=start)continue;
  let valid=true;
  for(let t=start;t<end;t++){const actual=counts(t);if(actual[0]!==expected[0]||actual[1]!==expected[1]){valid=false;break}}
  if(valid)candidates.push({period:a.period,startSecond:start,endSecondExclusive:end,seconds:end-start,strength:expected.join('v'),status:'candidate-only'});
 }
 return {status:'candidate-only',candidates,totalSeconds:candidates.reduce((n,c)=>n+c.seconds,0),verifiedStrengthWindows:false,verifiedUnits:false,reason:'Intervals between events with matching strength and shift counts are candidates, not independently verified continuous strength.'};
}
module.exports={candidateStrengthIntervals};
