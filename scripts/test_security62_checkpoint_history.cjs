#!/usr/bin/env node
'use strict';
// SECURITY-62: synthetic append-only machine checkpoint history and fork detection.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const keys=crypto.generateKeyPairSync('ed25519');
const attacker=crypto.generateKeyPairSync('ed25519');
const pinnedKey=keys.publicKey.export({format:'pem',type:'spki'});
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const signatureValid=(v,s)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),pinnedKey,Buffer.from(s,'base64'));}catch{return false;}};
const make=(sequence,previousHash,registryHash,archiveHash)=>{const body={schema:'security62_checkpoint_v1',sequence,previousHash,registryHash,archiveHash};return {body,signature:sign(body,keys.privateKey)};};
const records=[
 make(1,null,hash('registry-1'),hash('archive-1')),
 make(2,null,hash('registry-2'),hash('archive-2')),
 make(3,null,hash('registry-3'),hash('archive-3'))];
records[1]=make(2,hash(records[0]),records[1].body.registryHash,records[1].body.archiveHash);
records[2]=make(3,hash(records[1]),records[2].body.registryHash,records[2].body.archiveHash);
function validate(chain,anchor){
 if(!Array.isArray(chain)||!chain.length)return false;
 for(let i=0;i<chain.length;i++){
  const entry=chain[i],b=entry?.body;
  if(b?.schema!=='security62_checkpoint_v1'||!Number.isSafeInteger(b.sequence)||
   b.sequence!==i+1||b.previousHash!==(i===0?null:hash(chain[i-1]))||
   !/^[0-9a-f]{64}$/.test(b.registryHash)||!/^[0-9a-f]{64}$/.test(b.archiveHash)||
   !signatureValid(b,entry.signature))return false;
 }
 return anchor?.sequence===chain.length&&anchor?.headHash===hash(chain[chain.length-1]);
}
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'security62-'));
try{
 const localPath=path.join(folder,'history.json');
 // In real deployment anchor must be retained by a separate, trusted machine.
 const anchorPath=path.join(folder,'independent-anchor.json');
 const anchor={sequence:3,headHash:hash(records[2])};
 const put=(p,v)=>fs.writeFileSync(p,canonical(v));
 const load=()=>validate(JSON.parse(fs.readFileSync(localPath,'utf8')),
  JSON.parse(fs.readFileSync(anchorPath,'utf8')));
 put(localPath,records);put(anchorPath,anchor);
 assert(load(),'intact checkpoint history accepted');
 put(localPath,records.slice(0,2));
 assert(!load(),'truncated tail rejected by independent head anchor');
 put(localPath,[records[0],records[2],records[1]]);
 assert(!load(),'reordered history rejected');
 put(localPath,[records[0],records[2]]);
 assert(!load(),'missing middle checkpoint rejected');
 const tampered=structuredClone(records);
 tampered[1].body.registryHash=hash('forged-registry');
 put(localPath,tampered);
 assert(!load(),'modified signed checkpoint rejected');
 const forged=structuredClone(records);
 forged[2].signature=sign(forged[2].body,attacker.privateKey);
 put(localPath,forged);
 assert(!load(),'attacker-signed checkpoint rejected');
 const fork=structuredClone(records);
 fork[2]=make(3,hash(fork[1]),hash('alternate-registry'),hash('alternate-archive'));
 put(localPath,fork);
 assert(!load(),'validly signed fork rejected by retained anchor');
 put(localPath,records);
 assert(load(),'restored history accepted');
 console.log('PASS SECURITY-62 signed checkpoint chain, deletion, reorder, tamper and fork detection');
}finally{fs.rmSync(folder,{recursive:true,force:true});}
