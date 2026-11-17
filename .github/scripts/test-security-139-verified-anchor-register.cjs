"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),cp=require("node:child_process");
const checkpoint=require("../../security/local/security136-signed-checkpoint.cjs");
const anchor=require("../../security/local/security137-independent-anchor.cjs");
const {submit}=require("../../security/local/security139-verified-anchor-register.cjs");
const issuer=crypto.generateKeyPairSync("ed25519"),authority=crypto.generateKeyPairSync("ed25519"),attacker=crypto.generateKeyPairSync("ed25519");
const issuerKeys={issuer:issuer.publicKey.export({type:"spki",format:"pem"})},anchorKeys={authority:authority.publicKey.export({type:"spki",format:"pem"})};
function sign(bytes,pair,id){return {algorithm:"Ed25519",key_id:id,signature:crypto.sign(null,bytes,pair.privateKey).toString("base64")};}
const scope="game:2026020335",dir=fs.mkdtempSync(path.join(os.tmpdir(),"security139-")),db=path.join(dir,"anchors.sqlite3");
function fixture(epoch,head){
 const c={version:1,digest:head.toString(16).padStart(64,"0"),heads:{[scope]:head}};
 const a={version:1,epoch,checkpoint_digest:anchor.fingerprint(c)};
 return {db,scope,checkpoint:c,checkpointEvidence:sign(checkpoint.canonical(c),issuer,"issuer"),checkpointKeys:issuerKeys,checkpointActiveIds:["issuer"],anchor:a,anchorEvidence:sign(anchor.canonical(a),authority,"authority"),anchorKeys,anchorActiveIds:["authority"],expectedEpoch:epoch};
}
function rows(){if(!fs.existsSync(db))return [];const script=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("s138",".github/scripts/test-security-138-anchor-register.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(m.state(sys.argv[1])))`;const r=cp.spawnSync("python3",["-c",script,db],{encoding:"utf8",timeout:20000});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
try{
 const one=fixture(1,1),two=fixture(2,2);
 assert.equal(submit(one),true);
 assert.equal(submit(one),false,"duplicate rejected");
 const before=JSON.stringify(rows());
 assert.equal(submit({...two,checkpoint:{...two.checkpoint,digest:"f".repeat(64)}}),false);
 assert.equal(submit({...two,anchor:{...two.anchor,epoch:3}}),false);
 assert.equal(submit({...two,checkpointEvidence:sign(checkpoint.canonical(two.checkpoint),attacker,"issuer")}),false);
 assert.equal(submit({...two,anchorEvidence:sign(anchor.canonical(two.anchor),attacker,"authority")}),false);
 assert.equal(submit({...two,anchorRevokedIds:["authority"]}),false);
 assert.equal(submit({...two,anchorActiveIds:[]}),false);
 assert.equal(submit({...two,expectedEpoch:3}),false);
 assert.equal(submit({...two,scope:"game:999"}),false);
 assert.equal(JSON.stringify(rows()),before,"invalid submissions cannot change register");
 assert.equal(submit(two),true);
 assert.equal(submit(one),false,"old signed anchor cannot roll register back");
 assert.equal(submit(fixture(4,4)),false,"epoch gap rejected");
 assert.equal(rows().length,1);
 assert.equal(rows()[0][1],2);
 console.log("SECURITY-139 signed checkpoint+anchor gated register PASS");
}finally{fs.rmSync(dir,{recursive:true,force:true});}
