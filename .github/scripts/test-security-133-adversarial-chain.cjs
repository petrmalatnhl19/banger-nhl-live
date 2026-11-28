"use strict";
// SECURITY-133: adversarial offline integration; synthetic keys and disposable SQLite only.
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const snap=require("../../security/local/security126-signed-snapshot.cjs"),issue=require("../../security/local/security131-signed-issuance.cjs");
const {TRUST}=require("../../security/local/security125-timestamp-provenance.cjs");
const pair=crypto.generateKeyPairSync("ed25519"),wrong=crypto.generateKeyPairSync("ed25519");
const keys={test:pair.publicKey.export({format:"pem",type:"spki"})},now=Date.parse("2026-11-17T10:00:00Z");
const snapshot={metadata:[{game_id:2026020335,game_date:"2026-11-17",away_team:"EDM",home_team:"FLA",status:"pending"}],predictions:[{game_id:2026020335,core42_away:2,core42_home:3,core43_away:2.5,core43_home:3.5,core43_preview_away:2.6,core43_preview_home:3.4,away_gsax_per100:null,home_gsax_per100:1.2}],metadataAsOf:"2026-11-17T09:59:00Z",predictionsAsOf:"2026-11-17T09:59:00Z"};
function sign(data,privateKey=pair.privateKey){return {algorithm:"Ed25519",key_id:"test",signature:crypto.sign(null,data,privateKey).toString("base64")};}
const snapEvidence=sign(snap.canonical(snapshot));
const payload={version:1,audience:"banger_tv_offline",scope:"game:2026020335",sequence:1,digest:snap.digest(snapshot),issued_at:"2026-11-17T09:59:00Z",expires_at:"2026-11-17T10:01:00Z"};
const issueEvidence=sign(issue.canonical(payload));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"security133-")),db=path.join(dir,"ledger.sqlite3");
function count(){if(!fs.existsSync(db))return 0;const r=cp.spawnSync("python3",["-c","import sqlite3,sys; c=sqlite3.connect(sys.argv[1]); print(c.execute('select count(*) from accepted').fetchone()[0])",db],{encoding:"utf8"});assert.equal(r.status,0,r.stderr);return Number(r.stdout.trim());}
function accept({s=snapshot,se=snapEvidence,p=payload,pe=issueEvidence,k=keys,active=["test"],revoked=[],at=now}={}){
 const verified=snap.verify({snapshot:s,evidence:se,publicKeys:k,now:at});
 if(verified.trust!==TRUST.VERIFIED)return false;
 const envelope=issue.verify({payload:p,evidence:pe,keys:k,activeIds:active,revokedIds:revoked,audience:"banger_tv_offline",now:at});
 if(!envelope.verified||envelope.digest!==verified.digest||envelope.scope!=="game:"+s.metadata[0].game_id)return false;
 const r=cp.spawnSync("python3",[".github/scripts/test-security-130-sqlite-replay.py","worker",db,envelope.scope,String(envelope.sequence),envelope.digest],{encoding:"utf8",timeout:20000});
 if(r.error)throw r.error;
 return r.status===0;
}
function reject(input,label){const before=count();assert.equal(accept(input),false,label);assert.equal(count(),before,"rejected request changed ledger: "+label);}
try{
 reject({s:{...snapshot,predictions:[{...snapshot.predictions[0],core43_home:999}]}}, "tampered snapshot");
 reject({p:{...payload,digest:"b".repeat(64)}},"changed digest");
 reject({p:{...payload,sequence:2}},"changed sequence");
 reject({p:{...payload,scope:"game:99"}},"changed game scope");
 reject({p:{...payload,audience:"wrong"}},"changed audience");
 reject({p:{...payload,expires_at:"2026-11-17T10:03:00Z"}},"changed expiry");
 reject({pe:sign(issue.canonical(payload),wrong.privateKey)},"wrong signer");
 reject({se:sign(snap.canonical(snapshot),wrong.privateKey)},"wrong snapshot signer");
 reject({active:[]},"inactive key");
 reject({revoked:["test"]},"revoked key");
 reject({at:Date.parse("2026-11-17T10:02:00Z")},"expired");
 assert.equal(accept(),true,"first valid signed issuance");
 assert.equal(count(),1);
 reject({},"replayed issuance");
 const next={...payload,sequence:2,issued_at:"2026-11-17T09:59:01Z"};
 reject({p:next,pe:sign(issue.canonical(next))},"digest reused with new sequence");
 const old={...payload,sequence:1,issued_at:"2026-11-17T09:59:02Z"};
 reject({p:old,pe:sign(issue.canonical(old))},"sequence rollback");
 assert.equal(count(),1);
 console.log("SECURITY-133 adversarial signed snapshot/issuance/replay fail-closed PASS");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
