"use strict";
// SECURITY-125: offline timestamp provenance policy. No production integration.
// A client-provided timestamp is NEVER proof of server origin.
const {validateTimestamp}=require("./security123-public-contract.cjs");
const {VERSION}=require("./security118-tv-freshness.cjs");
const TRUST=Object.freeze({UNVERIFIED:"unverified",VERIFIED:"verified"});
function attest({metadataAsOf,predictionsAsOf,version=VERSION,evidence,verifyEvidence}={}){
 const fail=Object.freeze({trust:TRUST.UNVERIFIED,metadataAsOf:null,predictionsAsOf:null,version:null});
 try{
  if(version!==VERSION)return fail;
  validateTimestamp(metadataAsOf);validateTimestamp(predictionsAsOf);
  // A supplied boolean, self-asserted source, or local clock is not attestation.
  if(typeof verifyEvidence!=="function"||!evidence||typeof evidence!=="object"||Array.isArray(evidence))return fail;
  // Verifier must be independently supplied by a trusted caller, not by the payload.
  const verified=verifyEvidence(Object.freeze({metadataAsOf,predictionsAsOf,version}),evidence);
  if(verified!==true)return fail;
  return Object.freeze({trust:TRUST.VERIFIED,metadataAsOf,predictionsAsOf,version});
 }catch(_error){return fail;}
}
module.exports={attest,TRUST};
