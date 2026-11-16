#!/usr/bin/env node
'use strict';
// SECURITY-60: independent synthetic witness checkpoint detects simultaneous local rollback.
// Offline only: witness key and its last observed state must live outside the attacked store.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const keys=()=>crypto.generateKeyPairSync('ed25519');
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const check=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const root=keys(),witness=keys(),attacker=keys();
const rootPublic=root.publicKey.export({format:'pem',type:'spki'});
const witnessPublic=witness.publicKey.export({format:'pem',type:'spki'});
const key=keys().publicKey.export({format:'pem',type:'spki'});
const registry1={schema:'security60_registry_v1',version:1,previousHash:null,keys:[{id:'publisher',role:'publisher',publicKey:key,revoked:false}]};
const registry2={...registry1,version:2,previousHash:hash(registry1)};
const signedRegistry=body=>({body,signature:sign(body,root.privateKey)});
const checkpoint1={schema:'security60_checkpoint_v1',version:1,registryHash:hash(registry1),previousCheckpointHash:null};
const checkpoint2={schema:'security60_checkpoint_v1',version:2,registryHash:hash(registry2),previousCheckpointHash:hash(checkpoint1)};
const signedCheckpoint=body=>({body,signature:sign(body,witness.privateKey)});
function verify(registryEnvelope,localCheckpoint,witnessEnvelope){
 try{
  const r=registryEnvelope.body,c=localCheckpoint,w=witnessEnvelope.body;
  if(r.schema!=='security60_registry_v1'||w.schema!=='security60_checkpoint_v1'||
   !check(r,registryEnvelope.signature,rootPublic)||
   !check(w,witnessEnvelope.signature,witnessPublic)||
   !Number.isSafeInteger(r.version)||!Number.isSafeInteger(w.version)||
   r.version!==c.version||r.version!==w.version||
   hash(r)!==c.registryHash||hash(r)!==w.registryHash||
   c.registryHash!==w.registryHash)return false;
  if(r.version>1&&(!r.previousHash||!w.previousCheckpointHash))return false;
  return true;
 }catch{return false;}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'security60-'));
try{
 const local=path.join(dir,'local'),external=path.join(dir,'external');
 fs.mkdirSync(local);fs.mkdirSync(external);
 const regPath=path.join(local,'registry.json'),cpPath=path.join(local,'checkpoint.json');
 const witnessPath=path.join(external,'witness-checkpoint.json');
 const put=(p,v)=>fs.writeFileSync(p,canonical(v));
 const get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const verifyDisk=()=>verify(get(regPath),get(cpPath),get(witnessPath));
 put(regPath,signedRegistry(registry2));put(cpPath,checkpoint2);put(witnessPath,signedCheckpoint(checkpoint2));
 assert(verifyDisk(),'latest registry and witness must match');
 // Attacker controls entire local directory but not separately retained witness.
 put(regPath,signedRegistry(registry1));put(cpPath,checkpoint1);
 assert(!verifyDisk(),'simultaneous rollback of registry and local checkpoint rejected');
 put(regPath,signedRegistry(registry2));put(cpPath,checkpoint2);
 assert(verifyDisk(),'recovered current state accepted');
 const forged={...checkpoint2,registryHash:'f'.repeat(64)};
 put(witnessPath,{body:forged,signature:sign(forged,attacker.privateKey)});
 assert(!verifyDisk(),'attacker forged external witness rejected');
 put(witnessPath,signedCheckpoint(checkpoint2));
 put(regPath,{body:registry2,signature:sign(registry2,attacker.privateKey)});
 assert(!verifyDisk(),'attacker forged registry rejected');
 put(regPath,signedRegistry(registry2));
 assert(verifyDisk());
 console.log('PASS SECURITY-60 independent synthetic witness detects local registry/checkpoint rollback');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
