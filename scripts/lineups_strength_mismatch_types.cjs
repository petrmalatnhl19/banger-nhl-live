'use strict';
// LINEUPS-03.17: characterize mismatch types, never correct source timestamps automatically.
function classifyStrengthMismatchEvents(boundaryAudit){
 const base={status:'unverified',total:0,byEventType:{},boundaryRelated:0,unexplained:0,verifiedStrengthWindows:false};
 if(!boundaryAudit||boundaryAudit.status!=='diagnostic-only'||!Array.isArray(boundaryAudit.examples))return base;
 const byEventType={};
 for(const item of boundaryAudit.examples){
  if(!item||typeof item.typeDescKey!=='string')continue;
  const type=item.typeDescKey;
  if(!Object.prototype.hasOwnProperty.call(byEventType,type))byEventType[type]=0;
  byEventType[type]++;
 }
 return {status:'diagnostic-only',total:boundaryAudit.mismatches,byEventType,boundaryRelated:boundaryAudit.nearShiftBoundary,unexplained:boundaryAudit.awayFromBoundary,reportedExamples:boundaryAudit.examples.length,examplesTruncated:boundaryAudit.mismatches>boundaryAudit.examples.length,verifiedStrengthWindows:false,reason:'Event category and boundary proximity do not prove before/after semantics.'};
}
module.exports={classifyStrengthMismatchEvents};
