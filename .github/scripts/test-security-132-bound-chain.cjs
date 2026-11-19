"use strict";
// SECURITY-132: offline end-to-end fixture; no production signing or database access.
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const snapshotVerifier=require("../../security/local/security126-signed-snapshot.cjs");
const issuance=require("../../security/local/security131-signed-issuance.cjs");
const {TRUST}=require("../../security/local/security125-timestamp-provenance.cjs");
const key=crypto.generateKeyPairSync("ed25519");
const keys={test:key.publicKey.export({type:"spki",format:"pem"})};
const now=Date.parse("2026-11-17T10:00:00Z");
const snapshot={metadata:[{game_id:2026020335,game_date:"2026-11-17",away_team:"EDM",home_team:"FLA",status:"pending"}],predictions:[{game_id:2026020335,core42_away:2,core42_home:3,core43_away:2.5,core43_home:3.5,core43_preview_away:2.6,core43_preview_home:3.4,away_gsax_per100:null,home_gsax_per100:1.2}],metadataAsOf:"2026-11-17T09:59:00Z",predictionsAsOf:"2026-11-17T09:59:00Z"};
function sign(bytes){return {algorithm:"Ed25519",key_id:"test",signature:crypto.sign(null,bytes,key.privateKey).toString("base64")};}
const snapshotEvidence=sign(snapshotVerifier.canonical(snapshot));
const digest=snapshotVerifier.digest(snapshot);
const payload={version:1,audience:"banger_tv_offline",scope:"game:2026020335",sequence:1,digest,issued_at:"2026-11-17T09:59:00Z",expires_at:"2026-11-17T10:01:00Z"};
const envelopeEvidence=sign(issuance.canonical(payload));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"security132-")),db=path.join(dir,"ledger.sqlite3");
function accept({snap=snapshot,snapEvidence=snapshotEvidence,envelope=payload,envEvidence=envelopeEvidence,at=now}={}){
 const verifiedSnapshot=snapshotVerifier.verify({snapshot:snap,evidence:snapEvidence,publicKeys:keys,now:at});
 if(verifiedSnapshot.trust!==TRUST.VERIFIED)return false;
 const verifiedEnvelope=issuance.verify({payload:envelope,evidence:envEvidence,keys,activeIds:["test"],audience:"banger_tv_offline",now:at});
 if(!verifiedEnvelope.verified||verifiedEnvelope.digest!==verifiedSnapshot.digest||verifiedEnvelope.scope!=="game:"+snap.metadata[0].game_id)return false;
 const result=cp.spawnSync("python3",[".github/scripts/test-security-130-sqlite-replay.py","worker",db,verifiedEnvelope.scope,String(verifiedEnvelope.sequence),verifiedEnvelope.digest],{encoding:"utf8",timeout:20000});
 if(result.error)throw result.error;
 return result.status===0;
}
try{
 assert.equal(accept({snap:{...snapshot,predictions:[{...snapshot.predictions[0],core43_home:999}]}}),false,"tampered snapshot rejected");
 assert.equal(accept({envelope:{...payload,digest:"f".repeat(64)}}),false,"tampered signed digest rejected");
 assert.equal(accept({envelope:{...payload,scope:"game:123"}}),false,"wrong scope rejected");
 assert.equal(accept({at:Date.parse("2026-11-17T10:02:00Z")}),false,"expired envelope rejected");
 assert.equal(accept(),true,"first fully verified issuance accepted");
 assert.equal(accept(),false,"same issuance replay denied");
 const payload2={...payload,sequence:2,issued_at:"2026-11-17T09:59:01Z"};
 assert.equal(accept({envelope:payload2,envEvidence:sign(issuance.canonical(payload2))}),false,"same digest cannot be reissued");
 const state=cp.spawnSync("python3",["-c","import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); assert c.execute('select count(*) from accepted').fetchone()[0]==1",db],{encoding:"utf8"});
 assert.equal(state.status,0,state.stderr);
 console.log("SECURITY-132 signed snapshot + signed issuance + disposable SQLite replay PASS");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
