"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {attest,TRUST}=require("../../security/local/security125-timestamp-provenance.cjs");
const base={metadataAsOf:"2026-11-17T09:59:00Z",predictionsAsOf:"2026-11-17T09:59:00Z"};
const untrusted=attest(base);
assert.equal(untrusted.trust,TRUST.UNVERIFIED);
assert.equal(untrusted.metadataAsOf,null);
for(const patch of [
 {evidence:{verified:true,source:"server"}},
 {evidence:{verified:true},verifyEvidence:()=>false},
 {evidence:{verified:true},verifyEvidence:()=>{throw Error("private key leaked");}},
 {evidence:{verified:true},verifyEvidence:()=>({verified:true})},
 {metadataAsOf:"2026-11-17T10:00:00+01:00",evidence:{},verifyEvidence:()=>true},
 {metadataAsOf:"2026-02-30T09:59:00Z",evidence:{},verifyEvidence:()=>true},
 {version:"tv-public-v0",evidence:{},verifyEvidence:()=>true},
 {evidence:null,verifyEvidence:()=>true}
]){
 const result=attest({...base,...patch});
 assert.equal(result.trust,TRUST.UNVERIFIED);
 assert.equal(result.metadataAsOf,null);
 assert(!JSON.stringify(result).includes("private key"));
}
let called=0;
const verified=attest({...base,evidence:{signedEnvelope:"synthetic-only"},verifyEvidence:(payload,evidence)=>{
 called++;
 assert.deepEqual(payload,{...base,version:"tv-public-v1"});
 assert.equal(evidence.signedEnvelope,"synthetic-only");
 return true;
}});
assert.equal(called,1);
assert.equal(verified.trust,TRUST.VERIFIED);
// This mock verifier proves only policy wiring, NOT cryptographic origin.
const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
assert(!html.includes("security125-timestamp-provenance.cjs"));
console.log("SECURITY-125 offline provenance policy passed (synthetic verifier only)");
