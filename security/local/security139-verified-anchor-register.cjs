"use strict";
// SECURITY-139: offline signed checkpoint+anchor validation before invoking disposable SQLite register.
// The Python worker is NOT a protected trust boundary; production use is forbidden.
const crypto=require("node:crypto");
const cp=require("node:child_process");
const {verify:verifyCheckpoint}=require("./security136-signed-checkpoint.cjs");
const {verifyAnchor,fingerprint}=require("./security137-independent-anchor.cjs");
function submit({db,scope,checkpoint,checkpointEvidence,checkpointKeys,checkpointActiveIds,anchor,anchorEvidence,anchorKeys,anchorActiveIds,anchorRevokedIds=[],expectedEpoch}={}){
 try{
  if(typeof db!=="string"||!db||typeof scope!=="string"||!/^game:[0-9]{1,12}$/.test(scope)||!Number.isSafeInteger(expectedEpoch)||expectedEpoch<=0)return false;
  const verified=verifyCheckpoint({checkpoint,evidence:checkpointEvidence,keys:checkpointKeys,activeIds:checkpointActiveIds});
  if(!verified||!verifyAnchor({anchor,evidence:anchorEvidence,keys:anchorKeys,activeIds:anchorActiveIds,revokedIds:anchorRevokedIds}))return false;
  if(anchor.epoch!==expectedEpoch||anchor.checkpoint_digest!==fingerprint(checkpoint)||!Object.hasOwn(verified.heads,scope))return false;
  const script=`import importlib.util,sys
spec=importlib.util.spec_from_file_location("s138",".github/scripts/test-security-138-anchor-register.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
sys.exit(0 if m.update(sys.argv[1],sys.argv[2],int(sys.argv[3]),sys.argv[4]) else 1)`;
  const result=cp.spawnSync("python3",["-c",script,db,scope,String(anchor.epoch),anchor.checkpoint_digest],{timeout:20000,encoding:"utf8"});
  return result.status===0;
 }catch{return false;}
}
module.exports={submit};
