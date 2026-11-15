"use strict";
// CAL-29: independent RFC3161 dual-authority pregame gate.
// Offline only: does not fetch TSA responses or establish operational independence.
const {verifyTimestamp}=require("./core43_cal16_timestamp.cjs");
const {createHash}=require("node:crypto");
const HEX=/^[a-f0-9]{64}$/;
const PIN=/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;
function verifyIndependentPregameTimestamps({packageBytes,officialStartAt,authorities,minimumAuthorities=2}){
 if(!Buffer.isBuffer(packageBytes)||packageBytes.length===0||
    !Number.isSafeInteger(minimumAuthorities)||minimumAuthorities<2||
    !Array.isArray(authorities)||authorities.length<minimumAuthorities||authorities.length>8)
   throw Error("cal29_invalid_input");
 const start=Date.parse(officialStartAt);
 if(typeof officialStartAt!=="string"||!Number.isFinite(start)||
    new Date(start).toISOString()!==officialStartAt)
   throw Error("cal29_invalid_official_start");
 const fingerprints=new Set(),domains=new Set(),results=[];
 const digest=createHash("sha256").update(packageBytes).digest("hex");
 for(const item of authorities){
   if(!item||typeof item!=="object"||Array.isArray(item)||
      Object.keys(item).sort().join(",")!=="authority,request,response,trustDomain")
     throw Error("cal29_invalid_authority_record");
   const {authority,trustDomain,request,response}=item;
   if(typeof trustDomain!=="string"||!/^[A-Za-z0-9._:-]{3,128}$/.test(trustDomain)||
      domains.has(trustDomain)||authority?.kind!=="independent"||
      !PIN.test(authority.signerFingerprint256)||fingerprints.has(authority.signerFingerprint256))
     throw Error("cal29_authorities_not_distinct");
   // Full RFC3161 verification, nonce binding, CA validation, policy and signer pin are
   // enforced by CAL16. Never accept a self-declared timestamp in lieu of a token.
   const result=verifyTimestamp({packageBytes,request,response,authority});
   if(result.digest!==digest||!HEX.test(result.digest)||
      !Number.isSafeInteger(result.latestMs)||result.latestMs>=start)
     throw Error("cal29_late_or_unbound_timestamp");
   domains.add(trustDomain);fingerprints.add(authority.signerFingerprint256);
   results.push({trustDomain,latestMs:result.latestMs});
 }
 return {digest,authorityCount:results.length,latestVerifiedMs:Math.max(...results.map(x=>x.latestMs)),
   cryptographicTokensValid:true,trusted:false,status:"offline_independent_tsa_evidence_only"};
}
module.exports={verifyIndependentPregameTimestamps};
