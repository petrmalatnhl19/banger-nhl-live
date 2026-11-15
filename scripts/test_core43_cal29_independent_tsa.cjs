"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {verifyIndependentPregameTimestamps:run}=require("./core43_cal29_independent_tsa.cjs");
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
test("CAL-29 rejects test authority",()=>{
 const f=fixture();f.authorities[0].authority.kind="test";
 assert.throws(()=>run(f),/authorities_not_distinct/);
});
test("CAL-29 rejects unverified synthetic RFC3161 bytes",()=>{
 assert.throws(()=>run(fixture()),/cal16_/);
});
test("CAL-29 rejects extra untrusted authority fields",()=>{
 const f=fixture();f.authorities[0].trusted=true;
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
