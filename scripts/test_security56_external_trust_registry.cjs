#!/usr/bin/env node
'use strict';
// SECURITY-56: synthetic offline trust registry kept outside archived evidence.
// All identities and keys are ephemeral test fixtures, never production trust roots.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const pair=()=>crypto.generateKeyPairSync('ed25519');
const sign=(obj,key)=>crypto.sign(null,Buffer.from(canonical(obj)),key).toString('base64');
const check=(obj,sig,key)=>{try{return crypto.verify(null,Buffer.from(canonical(obj)),key,Buffer.from(sig,'base64'));}catch{return false;}};
const publisher=pair(),witness=pair(),attacker=pair();
const pub=key=>key.export({format:'pem',type:'spki'});
const trust={
 schema:'security56_trust_v1',
 entries:[
  {id:'synthetic-publisher',role:'publisher',keyId:'publisher-v1',publicKey:pub(publisher.publicKey),validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-01T00:00:00Z',revoked:false},
  {id:'synthetic-witness',role:'witness',keyId:'witness-v1',publicKey:pub(witness.publicKey),validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-01T00:00:00Z',revoked:false}
 ]};
const source={gameId:'synthetic-56',status:'scheduled',cutoff:'2026-11-16T19:00:00Z',
 publishedAt:'2026-11-16T18:20:00Z',prediction:{away:2.7,home:3.1}};
const witnessRecord={sourceHash:hash(source),observedAt:'2026-11-16T18:40:00Z'};
const archive={
 source,sourceSignature:sign(source,publisher.privateKey),publisherKeyId:'publisher-v1',
 witnessRecord,witnessSignature:sign(witnessRecord,witness.privateKey),witnessKeyId:'witness-v1',
 // Archive-carried keys are deliberately untrusted.
 publisherPublicKey:pub(publisher.publicKey),witnessPublicKey:pub(witness.publicKey)
};
function verify(a,registry){
 if(registry.schema!=='security56_trust_v1')return false;
 const lookup=(role,id)=>{
  const candidates=registry.entries.filter(e=>e.role===role&&e.keyId===id&&!e.revoked);
  if(candidates.length!==1)return null;
  const e=candidates[0],t=Date.parse(a.witnessRecord.observedAt);
  return Number.isFinite(t)&&Date.parse(e.validFrom)<=t&&t<Date.parse(e.validUntil)?e.publicKey:null;
 };
 const p=lookup('publisher',a.publisherKeyId),w=lookup('witness',a.witnessKeyId);
 const cutoff=Date.parse(a.source.cutoff);
 return !!p&&!!w&&p!==w&&
  a.source.status==='scheduled'&&a.source.gameId==='synthetic-56'&&
  Date.parse(a.source.publishedAt)<=Date.parse(a.witnessRecord.observedAt)&&
  Date.parse(a.witnessRecord.observedAt)<=cutoff&&
  a.witnessRecord.sourceHash===hash(a.source)&&
  check(a.source,a.sourceSignature,p)&&check(a.witnessRecord,a.witnessSignature,w);
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'security56-'));
try{
 const trustPath=path.join(tmp,'trusted-keys.json'),archivePath=path.join(tmp,'evidence.json');
 fs.writeFileSync(trustPath,canonical(trust));
 fs.writeFileSync(archivePath,canonical(archive));
 const registry=JSON.parse(fs.readFileSync(trustPath,'utf8'));
 const persisted=JSON.parse(fs.readFileSync(archivePath,'utf8'));
 assert(verify(persisted,registry),'valid external trust registry must pass');
 const forged={...persisted,source:{...source,prediction:{away:9,home:9}},
  sourceSignature:sign({...source,prediction:{away:9,home:9}},attacker.privateKey),
  publisherPublicKey:pub(attacker.publicKey)};
 assert(!verify(forged,registry),'replacing archive key and re-signing must fail');
 assert(!verify({...persisted,witnessPublicKey:pub(attacker.publicKey),
  witnessSignature:sign(witnessRecord,attacker.privateKey)},registry),'forged witness must fail');
 assert(!verify(persisted,{...registry,entries:registry.entries.map(e=>e.role==='publisher'?{...e,revoked:true}:e)}),'revoked key');
 assert(!verify(persisted,{...registry,entries:registry.entries.map(e=>e.role==='witness'?{...e,validUntil:'2026-11-16T18:00:00Z'}:e)}),'expired witness key');
 assert(!verify({...persisted,publisherKeyId:'unknown'},registry),'unknown key id');
 assert(!verify(persisted,{...registry,entries:[...registry.entries,registry.entries[0]]}),'duplicate key id');
 assert(!verify({...persisted,witnessRecord:{...witnessRecord,observedAt:'2026-11-16T19:01:00Z'}},registry),'late witness');
 assert(!verify({...persisted,source:{...source,gameId:'other'}},registry),'cross-game replay');
 console.log('PASS SECURITY-56 external synthetic key registry, forgery, revocation and expiry');
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
