#!/usr/bin/env node
'use strict';
// SECURITY-58: offline signed trust-registry version and rollback protection.
// Root key is independently pinned in verifier; no real-world root is provisioned.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const digest=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const verifySignature=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const root=crypto.generateKeyPairSync('ed25519');
const attacker=crypto.generateKeyPairSync('ed25519');
const key=crypto.generateKeyPairSync('ed25519');
const pub=k=>k.export({format:'pem',type:'spki'});
const pinnedRoot=pub(root.publicKey);
const base={schema:'security58_registry_v1',version:1,previousHash:null,
 keys:[{id:'synthetic-publisher',role:'publisher',publicKey:pub(key.publicKey),revoked:false}]};
const updated={...base,version:2,previousHash:digest(base),
 keys:[{...base.keys[0],revoked:true}]};
const signed=(body,privateKey)=>({body,signature:sign(body,privateKey)});
const first=signed(base,root.privateKey),second=signed(updated,root.privateKey);
function accept(record,rootKey,minimumVersion,expectedPreviousHash){
 const b=record?.body;
 if(b?.schema!=='security58_registry_v1'||!Number.isSafeInteger(b.version)||
  b.version<minimumVersion||!Array.isArray(b.keys)||
  !verifySignature(b,record.signature,rootKey))return false;
 if(expectedPreviousHash!==undefined&&b.previousHash!==expectedPreviousHash)return false;
 const ids=new Set();
 for(const k of b.keys){
  if(!k.id||!['publisher','witness'].includes(k.role)||typeof k.publicKey!=='string'||
   typeof k.revoked!=='boolean'||ids.has(k.role+':'+k.id))return false;
  ids.add(k.role+':'+k.id);
 }
 return true;
}
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'security58-'));
try{
 const registryPath=path.join(folder,'registry.json');
 // Last accepted version/hash is independent of untrusted registry file.
 const checkpointPath=path.join(folder,'pinned-checkpoint.json');
 fs.writeFileSync(registryPath,canonical(first));
 fs.writeFileSync(checkpointPath,canonical({minimumVersion:1,acceptedHash:digest(base)}));
 const read=()=>JSON.parse(fs.readFileSync(registryPath,'utf8'));
 let checkpoint=JSON.parse(fs.readFileSync(checkpointPath,'utf8'));
 assert(accept(read(),pinnedRoot,checkpoint.minimumVersion));
 fs.writeFileSync(registryPath,canonical(second));
 assert(accept(read(),pinnedRoot,checkpoint.minimumVersion+1,checkpoint.acceptedHash));
 fs.writeFileSync(checkpointPath,canonical({minimumVersion:2,acceptedHash:digest(updated)}));
 checkpoint=JSON.parse(fs.readFileSync(checkpointPath,'utf8'));
 assert(accept(read(),pinnedRoot,checkpoint.minimumVersion));
 fs.writeFileSync(registryPath,canonical(first));
 assert(!accept(read(),pinnedRoot,checkpoint.minimumVersion),'rollback must fail');
 fs.writeFileSync(registryPath,canonical(signed({...updated,keys:[{...base.keys[0],revoked:false}]},attacker.privateKey)));
 assert(!accept(read(),pinnedRoot,checkpoint.minimumVersion),'attacker-signed registry must fail');
 fs.writeFileSync(registryPath,canonical(signed({...updated,version:3,previousHash:'wrong'},root.privateKey)));
 assert(!accept(read(),pinnedRoot,checkpoint.minimumVersion+1,checkpoint.acceptedHash),'broken chain must fail');
 fs.writeFileSync(registryPath,canonical(signed({...updated,version:3,previousHash:checkpoint.acceptedHash,
  keys:[updated.keys[0],updated.keys[0]]},root.privateKey)));
 assert(!accept(read(),pinnedRoot,checkpoint.minimumVersion+1,checkpoint.acceptedHash),'duplicate IDs must fail');
 fs.writeFileSync(registryPath,canonical(second));
 assert(accept(read(),pinnedRoot,checkpoint.minimumVersion),'valid current registry remains usable');
 console.log('PASS SECURITY-58 pinned root signature, version checkpoint and registry rollback rejection');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
