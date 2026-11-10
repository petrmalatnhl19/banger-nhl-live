/* CORE 4.3 Projected: read-only, uncalibrated candidate-mixture experiment.
 * Probabilities must be supplied by a future provenance-checked source;
 * they are NEVER inferred from 'expected' labels or treated as confirmation.
 */
"use strict";
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const finite=x=>typeof x==="number"&&Number.isFinite(x);
function calculateProjectedShadow({baseline,awayCandidates,homeCandidates,asOf,kickoffUTC,coefficient}={}){
 const fail=reason=>({available:false,reason,production:false,persistable:false});
 if(!validTime(asOf)||!validTime(kickoffUTC)||Date.parse(asOf)>=Date.parse(kickoffUTC))
  return fail("invalid_pregame_time");
 const mixture=(rows,side)=>{
  if(!Array.isArray(rows)||rows.length<1||rows.length>5)return {error:"missing_"+side+"_candidates"};
  const ids=new Set();let sum=0,weighted=0,shots=Infinity;
  for(const r of rows){
   if(!r||!/^\d+$/.test(String(r.goalieId||""))||ids.has(String(r.goalieId)))
    return {error:"invalid_"+side+"_identity"};
   ids.add(String(r.goalieId));
   if(!finite(r.probability)||r.probability<0||r.probability>1)
    return {error:"invalid_"+side+"_probability"};
   if(!finite(r.gsaxPer100Shots)||!Number.isInteger(r.shotsAgainst)||r.shotsAgainst<30)
    return {error:"missing_"+side+"_gsax"};
   if(!validTime(r.fetchedAt)||Date.parse(r.fetchedAt)>Date.parse(asOf))
    return {error:"late_"+side+"_gsax"};
   if(!validTime(r.projectionPublishedAt)||Date.parse(r.projectionPublishedAt)>Date.parse(asOf))
    return {error:"late_"+side+"_projection"};
   if(typeof r.projectionSource!=="string"||!r.projectionSource.trim())
    return {error:"missing_"+side+"_projection_source"};
   sum+=r.probability;weighted+=r.probability*r.gsaxPer100Shots;
   shots=Math.min(shots,r.shotsAgainst);
  }
  if(Math.abs(sum-1)>0.000001)return {error:"unnormalized_"+side+"_probabilities"};
  return {goalie:{available:true,value:{gsaxPer100Shots:weighted,shotsAgainst:shots,
    fetchedAt:asOf}},ids};
 };
 const away=mixture(awayCandidates,"away");if(away.error)return fail(away.error);
 const home=mixture(homeCandidates,"home");if(home.error)return fail(home.error);
 for(const id of away.ids)if(home.ids.has(id))return fail("duplicate_goalie_across_teams");
 const result=calculateShadow({baseline,awayGoalie:away.goalie,homeGoalie:home.goalie,asOf,coefficient});
 if(!result.available)return {...result,persistable:false};
 return {...result,model:"core43_projected_candidate_mixture_v0",
  persistable:false,starterEvidence:"projected_not_confirmed",
  calibrated:false,warning:"Uncalibrated scenario using externally supplied candidate probabilities; not a verified starter or production forecast."};
}
module.exports={calculateProjectedShadow};
