"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const {canonical,verify}=require("../../security/local/security136-signed-checkpoint.cjs");
const key=crypto.generateKeyPairSync("ed25519"),wrong=crypto.generateKeyPairSync("ed25519");
const keys={test:key.publicKey.export({format:"pem",type:"spki"})};
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"security136-")),db=path.join(dir,"live.sqlite3"),backup=path.join(dir,"backup.sqlite3");
function py(code,args=[]){const r=cp.spawnSync("python3",["-c",code,...args],{encoding:"utf8",timeout:20000});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const worker=".github/scripts/test-security-130-sqlite-replay.py";
function issue(n){const r=cp.spawnSync("python3",[worker,"worker",db,"game:2026020335",String(n),String(n).padStart(64,"0")],{encoding:"utf8",timeout:20000});assert.equal(r.status,0,r.stderr);}
const checkpointScript=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("s135",".github/scripts/test-security-135-backup-rollback.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(m.checkpoint(sys.argv[1]),sort_keys=True))`;
function checkpoint(file){return JSON.parse(py(checkpointScript,[file]));}
function sign(p,privateKey=key.privateKey){return {algorithm:"Ed25519",key_id:"test",signature:crypto.sign(null,canonical(p),privateKey).toString("base64")};}
function restoreAllowed(file,p,e,policy={}){
 const trusted=verify({checkpoint:p,evidence:e,keys,activeIds:policy.activeIds||["test"],revokedIds:policy.revokedIds||[]});
 if(!trusted)return false;
 const state=checkpoint(file);
 return state.digest===trusted.digest&&Object.entries(trusted.heads).every(([scope,seq])=>state.heads[scope]===seq);
}
try{
 issue(1);
 fs.copyFileSync(db,backup);
 issue(2);
 const cp2={version:1,...checkpoint(db)},signature=sign(cp2);
 assert.equal(restoreAllowed(db,cp2,signature),true);
 assert.equal(restoreAllowed(backup,cp2,signature),false,"old backup denied");
 const cases=[
  [{...cp2,digest:"f".repeat(64)},signature],
  [{...cp2,heads:{"game:2026020335":1}},signature],
  [cp2,sign(cp2,wrong.privateKey)],
  [cp2,{...signature,signature:"A".repeat(88)}]
 ];
 for(const [p,e] of cases)assert.equal(restoreAllowed(db,p,e),false);
 assert.equal(restoreAllowed(db,cp2,signature,{revokedIds:["test"]}),false);
 assert.equal(restoreAllowed(db,cp2,signature,{activeIds:[]}),false);
 assert.equal(restoreAllowed(db,cp2,signature),true,"rejected attempts did not alter database");
 const cp1={version:1,...checkpoint(backup)},sig1=sign(cp1);
 assert.equal(restoreAllowed(backup,cp1,sig1),true,"older correctly signed checkpoint alone cannot prove freshness");
 assert.equal(restoreAllowed(backup,cp2,signature),false,"independently retained newer checkpoint rejects rollback");
 console.log("SECURITY-136 signed checkpoint tamper, key policy, stale backup PASS");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
