'use strict';
// LINEUPS-03.51: roster-grounded skater identities across recovery segments.
// Shift overlap is not independent strength verification.
function auditRecoverySkaterIdentities({segmentAudit,shifts,awayId,homeId}={}){
 const fail=reason=>({status:'unverified',reason,segments:[],verifiedStrength:false,publishable:false});
 if(segmentAudit?.status!=='candidate-only'||!Array.isArray(segmentAudit.segments)||!Array.isArray(shifts)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return fail('invalid-input');
 const segments=[];
 for(const s of segmentAudit.segments){
  if(!Number.isInteger(s?.startSecond)||!Number.isInteger(s?.endSecondExclusive)||s.startSecond<0||s.endSecondExclusive<=s.startSecond||s.endSecondExclusive>3600)return fail('invalid-segment');
  let completeSeconds=0,ambiguousSeconds=0,distinctUnits=new Set();
  for(let t=s.startSecond;t<s.endSecondExclusive;t++){
   const units=[];
   for(const teamId of [awayId,homeId]){
    const players=new Set();let overlaps=0;
    for(const shift of shifts){
     if(shift?.teamId!==teamId)continue;
     if(!Number.isInteger(shift.playerId)||!Number.isInteger(shift.start)||!Number.isInteger(shift.end)||shift.start<0||shift.end<=shift.start||shift.end>3600)return fail('invalid-shift');
     if(shift.start<=t&&t<shift.end){overlaps++;players.add(shift.playerId);}
    }
    units.push({players,overlaps});
   }
   if(units.every(u=>u.players.size===5&&u.overlaps===5)){
    completeSeconds++;
    distinctUnits.add(units.map(u=>[...u.players].sort((a,b)=>a-b).join(',')).join('|'));
   }else ambiguousSeconds++;
  }
  segments.push({startSecond:s.startSecond,endSecondExclusive:s.endSecondExclusive,seconds:s.endSecondExclusive-s.startSecond,completeIdentitySeconds:completeSeconds,ambiguousIdentitySeconds:ambiguousSeconds,distinctCombinedUnits:distinctUnits.size,identityCoverageComplete:ambiguousSeconds===0,verifiedStrength:false,publishable:false});
 }
 return {status:'candidate-only',segments,verifiedStrength:false,publishable:false,note:'Five unique skater IDs per side each second is shiftchart-only evidence, not independent verification of 5v5 or player positions.'};
}
module.exports={auditRecoverySkaterIdentities};
