"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {canonical}=require("../../security/local/security126-signed-snapshot.cjs");
const {createLedger}=require("../../security/local/security128-durable-ledger.cjs");
const {TRUST}=require("../../security/local/security125-timestamp-provenance.cjs");
const directory=fs.mkdtempSync(path.join(os.tmpdir(),"security128-"));
try{
 const pair=crypto.generateKeyPairSync("ed25519");
 const publicKeys={test:pair.publicKey.export({format:"pem",type:"spki"})};
 const now=Date.parse("2026-11-17T10:00:00Z");
 function signed(time){
  const snapshot={metadata:[{game_id:2026020335,game_date:"2026-11-17",away_team:"EDM",home_team:"FLA",status:"pending"}],predictions:[{game_id:2026020335,core42_away:2,core42_home:3,core43_away:2.5,core43_home:3.5,core43_preview_away:2.6,core43_preview_home:3.4,away_gsax_per100:null,home_gsax_per100:1.2}],metadataAsOf:time,predictionsAsOf:time};
  return {snapshot,evidence:{algorithm:"Ed25519",key_id:"test",signature:crypto.sign(null,canonical(snapshot),pair.privateKey).toString("base64")},now};
 }
 const options={directory,publicKeys,activeKeyIds:["test"]};
 const first=signed("2026-11-17T09:58:00Z"),next=signed("2026-11-17T09:59:00Z");
 assert.equal(createLedger(options).accept(first).trust,TRUST.VERIFIED);
 assert.equal(createLedger(options).accept(first).trust,TRUST.UNVERIFIED,"restart must retain replay state");
 fs.mkdirSync(path.join(directory,"ledger.lock"));
 assert.equal(createLedger(options).accept(next).trust,TRUST.UNVERIFIED,"lock contention fails closed");
 fs.rmdirSync(path.join(directory,"ledger.lock"));
 assert.equal(createLedger(options).accept(next).trust,TRUST.VERIFIED);
 assert.equal(createLedger(options).accept(first).trust,TRUST.UNVERIFIED,"older snapshot rejected");
 const invalid=signed("2026-11-17T09:59:30Z");invalid.snapshot.predictions[0].core43_home=999;
 assert.equal(createLedger(options).accept(invalid).trust,TRUST.UNVERIFIED);
 assert.equal(createLedger({...options,activeKeyIds:[]}).accept(signed("2026-11-17T09:59:30Z")).trust,TRUST.UNVERIFIED);
 const state=JSON.parse(fs.readFileSync(path.join(directory,"ledger.json"),"utf8"));
 assert.equal(state.digests.length,2);
 fs.writeFileSync(path.join(directory,"ledger.json"),"{corrupt");
 assert.equal(createLedger(options).accept(signed("2026-11-17T09:59:30Z")).trust,TRUST.UNVERIFIED,"corruption fails closed");
 console.log("SECURITY-128 restart, replay, contention, corruption and tamper checks passed");
}finally{fs.rmSync(directory,{recursive:true,force:true});}
