"use strict";
// SECURITY-119: offline, fail-closed TV presentation state; not loaded by production.
const {check}=require("./security118-tv-freshness.cjs");
const STATES=Object.freeze({READY:"ready",UNAVAILABLE:"unavailable",STALE:"stale",INCOMPLETE:"incomplete",INVALID:"invalid"});
function present(snapshot){
 try{
  const verified=check(snapshot);
  return {state:STATES.READY,rows:verified.rows,as_of:verified.as_of,snapshot_version:verified.snapshot_version};
 }catch(error){
  // Never expose internal error messages or fallback to private legacy sources.
  const msg=error instanceof Error?error.message:"";
  const state=/stale snapshot|future snapshot|snapshot skew/.test(msg)?STATES.STALE:
   /incomplete prediction snapshot/.test(msg)?STATES.INCOMPLETE:
   /invalid predictions batch|invalid metadata batch/.test(msg)?STATES.UNAVAILABLE:STATES.INVALID;
  return {state,rows:[],as_of:null,snapshot_version:null};
 }
}
module.exports={present,STATES};
