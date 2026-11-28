"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {execFileSync}=require("node:child_process");
const {readFileSync}=require("node:fs");
const {join}=require("node:path");
const {verifyIndependentPregameTimestamps:run}=require("./core43_cal29_independent_tsa.cjs");
const {verifyTimestamp}=require("./core43_cal16_timestamp.cjs");
const {createSignedArchiveFixture}=require("./fixtures/core43_cal28_signed_archive.cjs");
const bytes=Buffer.from("synthetic-prediction");
const start="2026-11-15T22:00:00.000Z";
const fp=n=>Array(32).fill(n).join(":");
const authority=(id,fingerprint)=>({trustDomain:id,authority:{
 kind:"independent",signerFingerprint256:fingerprint,caPem:Buffer.from("bad-ca"),
 policyOid:"1.2.3",maxAccuracyMs:1000},request:Buffer.from("bad-query"),
 response:Buffer.from("bad-response")});
const fixture=()=>({packageBytes:bytes,officialStartAt:start,authorities:[
 authority("tsa-one",fp("AA")),authority("tsa-two",fp("BB"))]});
test("CAL-29 rejects missing TSA evidence",()=>{
 const f=fixture();f.authorities=[];assert.throws(()=>run(f),/invalid_input/);
});
test("CAL-29 rejects single authority",()=>{
 const f=fixture();f.authorities.pop();assert.throws(()=>run(f),/invalid_input/);
});
test("CAL-29 rejects duplicate trust domain",()=>{
 const f=fixture();f.authorities[1].trustDomain="tsa-one";
 assert.throws(()=>run(f),/authorities_not_distinct/);
});
test("CAL-29 rejects duplicate signer pin",()=>{
 const f=fixture();f.authorities[1].authority.signerFingerprint256=fp("AA");
 assert.throws(()=>run(f),/authorities_not_distinct/);
});
test("CAL-29 checks duplicates anywhere in the list before verifying tokens",()=>{
 const f=fixture();
 f.authorities.push(authority("tsa-three",fp("BB")));
 assert.throws(()=>run(f),{message:"cal29_authorities_not_distinct"});
 f.authorities[2]=authority("tsa-two",fp("CC"));
 assert.throws(()=>run(f),{message:"cal29_authorities_not_distinct"});
});
test("CAL-29 rejects a non-string signer pin in a later record",()=>{
 const f=fixture();
 f.authorities[1].authority.signerFingerprint256=[fp("BB")];
 assert.throws(()=>run(f),{message:"cal29_authorities_not_distinct"});
});
test("CAL-29 rejects test authority",()=>{
 const f=fixture();f.authorities[0].authority.kind="test";
 assert.throws(()=>run(f),/authorities_not_distinct/);
});
test("CAL-29 rejects unverified synthetic RFC3161 bytes",()=>{
 assert.throws(()=>run(fixture()),/cal16_/);
});
test("CAL-29 rejects extra untrusted authority fields",()=>{
 const f=fixture();f.authorities[1].trusted=true;
 assert.throws(()=>run(f),/invalid_authority_record/);
});
test("CAL-29 rejects malformed kickoff",()=>{
 const f=fixture();f.officialStartAt="not-a-date";
 assert.throws(()=>run(f),/invalid_official_start/);
});
test("CAL-29 rejects missing package",()=>{
 const f=fixture();f.packageBytes=Buffer.alloc(0);
 assert.throws(()=>run(f),/invalid_input/);
});
test("CAL-29 rejects an invalid authority count",()=>{
 assert.throws(()=>run({...fixture(),minimumAuthorities:1}),/invalid_input/);
});

function readEvidence(dir, trustDomain) {
 const {kind,policyOid,maxAccuracyMs,signerFingerprint256,caFile} =
   JSON.parse(readFileSync(join(dir,"profile.json"),"utf8"));
 return {
   trustDomain,
   authority:{kind,policyOid,maxAccuracyMs,signerFingerprint256,caPem:readFileSync(caFile)},
   request:readFileSync(join(dir,"request.tsq")),
   response:readFileSync(join(dir,"response.tsr")),
 };
}

test("CAL-29 verifies two synthetic RFC 3161 tokens over the same signed package",t=>{
 const first=createSignedArchiveFixture(t);
 const second=createSignedArchiveFixture(t);
 const packagePath=join(first.dir,"exchange","bundle.json");
 const secondProfile=JSON.parse(readFileSync(join(second.dir,"profile.json"),"utf8"));
 const issue=args=>execFileSync("openssl",args,{cwd:second.dir,stdio:"ignore"});
 // Use the second fixture's TSA to issue a fresh token over the first fixture's exact bytes.
 issue(["ts","-query","-data",packagePath,"-sha256","-cert","-tspolicy",secondProfile.policyOid,"-out","request.tsq"]);
 issue(["ts","-reply","-config","tsa.conf","-queryfile","request.tsq","-out","response.tsr"]);
 const packageBytes=readFileSync(packagePath);
 const authorities=[readEvidence(first.dir,"tsa-one"),readEvidence(second.dir,"tsa-two")];
 const verified=authorities.map(evidence=>verifyTimestamp({packageBytes,...evidence}));
 const latestMs=Math.max(...verified.map(result=>result.latestMs));
 const options={packageBytes,authorities,officialStartAt:new Date(latestMs+1).toISOString()};
 assert.deepEqual(run(options),{
   digest:first.archived.manifest.packageDigest,
   authorityCount:2,
   latestVerifiedMs:latestMs,
   cryptographicTokensValid:true,
   trusted:false,
   status:"offline_independent_tsa_evidence_only",
 });
 for(const cutoff of [latestMs,latestMs-1]){
   assert.throws(()=>run({...options,officialStartAt:new Date(cutoff).toISOString()}),
     {message:"cal29_late_or_unbound_timestamp"});
 }
 assert.throws(()=>run({...options,packageBytes:Buffer.concat([packageBytes,Buffer.from(" ")])}),
   {message:"cal16_package_binding"});
 assert.throws(()=>run({...options,authorities:[authorities[0],{...authorities[1],request:authorities[0].request}]}),
   {message:"cal16_signature_or_nonce"});
});
