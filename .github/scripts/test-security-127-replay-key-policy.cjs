"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const {canonical}=require("../../security/local/security126-signed-snapshot.cjs");
const {createGate}=require("../../security/local/security127-replay-key-policy.cjs");
const {TRUST}=require("../../security/local/security125-timestamp-provenance.cjs");
const a=crypto.generateKeyPairSync("ed25519"),b=crypto.generateKeyPairSync("ed25519");
const publicKeys={active:a.publicKey.export({type:"spki",format:"pem"}),revoked:b.publicKey.export({type:"spki",format:"pem"})};
const now=Date.parse("2026-11-17T10:00:00Z");
function signed(time,key=a,key_id="active"){
 const snapshot={metadata:[{game_id:2026020335,game_date:"2026-11-17",away_team:"EDM",home_team:"FLA",status:"pending"}],predictions:[{game_id:2026020335,core42_away:2,core42_home:3,core43_away:2.5,core43_home:3.5,core43_preview_away:2.6,core43_preview_home:3.4,away_gsax_per100:null,home_gsax_per100:1.2}],metadataAsOf:time,predictionsAsOf:time};
 return {snapshot,evidence:{algorithm:"Ed25519",key_id,signature:crypto.sign(null,canonical(snapshot),key.privateKey).toString("base64")},now};
}
const gate=createGate({publicKeys,activeKeyIds:["active","revoked"],revokedKeyIds:["revoked"]});
const first=signed("2026-11-17T09:58:00Z");
assert.equal(gate.accept(first).trust,TRUST.VERIFIED);
assert.equal(gate.accept(first).trust,TRUST.UNVERIFIED);
assert.equal(gate.accept(signed("2026-11-17T09:57:00Z")).trust,TRUST.UNVERIFIED);
assert.equal(gate.accept(signed("2026-11-17T09:59:00Z",b,"revoked")).trust,TRUST.UNVERIFIED);
assert.equal(gate.accept(signed("2026-11-17T09:59:00Z")).trust,TRUST.VERIFIED);
assert.equal(gate.accept(signed("2026-11-17T09:58:30Z")).trust,TRUST.UNVERIFIED);
const unknown=createGate({publicKeys,activeKeyIds:[]});
assert.equal(unknown.accept(first).trust,TRUST.UNVERIFIED);
const tampered=signed("2026-11-17T09:59:30Z");
tampered.snapshot.predictions[0].core43_home=99;
assert.equal(gate.accept(tampered).trust,TRUST.UNVERIFIED);
assert.equal(gate.accept(signed("2026-11-17T09:59:30Z")).trust,TRUST.VERIFIED);
console.log("SECURITY-127 offline anti-replay and key policy passed");
