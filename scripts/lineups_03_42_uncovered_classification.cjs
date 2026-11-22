'use strict';
// LINEUPS-03.42: classify unclaimed seconds from roster-grounded shifts.
// Shift-count 5v5 is not independently verified event strength.
function classifyUncoveredSeconds({intervals,shifts,awayId,homeId,regulationSeconds=3600}={}){
 const fail=reason=>({status:'unverified',reason,verifiedStrength:false,publishable:false});
 if(!Array.isArray(intervals)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId||!Number.isInteger(regulationSeconds)||regulationSeconds<=0)return fail('invalid-input');
 const covered=new Uint8Array(regulationSeconds);
 for(const w of intervals){
  if(w?.strength!=='5v5')continue;
  if(!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<0||w.endSecondExclusive>regulationSeconds||w.endSecondExclusive<=w.startSecond)return fail('invalid-window');
  for(let t=w.startSecond;t<w.endSecondExclusive;t++){if(covered[t])return fail('overlapping-windows');covered[t]=1;}
 }
 const counts=new Map([[awayId,new Int16Array(regulationSeconds)],[homeId,new Int16Array(regulationSeconds)]]);
 const unique=new Set();
 for(const s of shifts){
  if(!s||!counts.has(s.teamId)||!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>regulationSeconds||s.end<=s.start)return fail('invalid-shift');
  const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(unique.has(key))return fail('duplicate-shift');unique.add(key);
  const a=counts.get(s.teamId);for(let t=s.start;t<s.end;t++)a[t]++;
 }
 const categories={fiveVsFiveCount:0,otherSkaterCounts:0,incompleteOrAmbiguous:0};
 const intervalsByCategory=[],getCategory=t=>{
  const a=counts.get(awayId)[t],h=counts.get(homeId)[t];
  if(a===5&&h===5)return 'fiveVsFiveCount';
  if(a>=3&&a<=6&&h>=3&&h<=6&&a!==h)return 'otherSkaterCounts';
  return 'incompleteOrAmbiguous';
 };
 let start=-1,current=null;
 for(let t=0;t<=regulationSeconds;t++){
  const kind=t<regulationSeconds&&!covered[t]?getCategory(t):null;
  if(kind!==current){
   if(current!==null)intervalsByCategory.push({category:current,startSecond:start,endSecondExclusive:t,seconds:t-start});
   current=kind;start=t;
  }
  if(kind)categories[kind]++;
 }
 return {status:'candidate-only',categories,uncoveredSeconds:Object.values(categories).reduce((a,b)=>a+b,0),allIntervals:intervalsByCategory.sort((a,b)=>a.startSecond-b.startSecond),topIntervals:intervalsByCategory.slice().sort((a,b)=>b.seconds-a.seconds||a.startSecond-b.startSecond).slice(0,20),verifiedStrength:false,publishable:false,note:'Counts reflect shift overlap only. Equal skater counts can include special situations; no independent strength verification.'};
}
module.exports={classifyUncoveredSeconds};
