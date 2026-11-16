#!/usr/bin/env node
'use strict';
// SECURITY-59: end-to-end synthetic signed archive and versioned registry gate.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {calculateShadow}=require('./core43_gsax_sensitivity.cjs');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const pair=()=>crypto.generateKeyPairSync('ed25519');
const pub=k=>k.export({format:'pem',type:'spki'});
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const valid=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const root=pair(),publisher=pair(),witness=pair(),attacker=pair();
const pinnedRoot=pub(root.publicKey);
const keyEntries=[
 {id:'publisher-v1',role:'publisher',publicKey:pub(publisher.publicKey),revoked:false},
 {id:'witness-v1',role:'witness',publicKey:pub(witness.publicKey),revoked:false}];
const registry1={schema:'security59_registry_v1',version:1,previousHash:null,keys:keyEntries};
const registry2={schema:'security59_registry_v1',version:2,previousHash:hash(registry1),keys:keyEntries};
const signedRegistry=b=>({body:b,signature:sign(b,root.privateKey)});
const source={gameId:'synthetic-59',status:'scheduled',cutoff:'2026-11-16T19:00:00Z',
 kickoff:'2026-11-16T20:00:00Z',publishedAt:'2026-11-16T18:10:00Z',
 baseline:{away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'},
 awayGoalie:{id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}},
 homeGoalie:{id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}}};
const sourceSignature=sign(source,publisher.privateKey);
const receipt={sourceHash:hash(source),sourceSignatureHash:hash(sourceSignature),
 observedAt:'2026-11-16T18:45:00Z'};
function compute(s){
 return [0,0.005,0.02,0.03].map(coefficient=>{
  const r=calculateShadow({baseline:s.baseline,awayGoalie:s.awayGoalie,homeGoalie:s.homeGoalie,
   asOf:s.cutoff,coefficient});
  if(!r.available)throw Error('experimental engine unavailable');
  return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,
   engine:r.model,production:false,persistable:false};
 });
}
const archive={schema:'security59_archive_v1',source,sourceSignature,publisherKeyId:'publisher-v1',
 receipt,receiptSignature:sign(receipt,witness.privateKey),witnessKeyId:'witness-v1',
 records:compute(source),production:false,writeEnabled:false};
function verify(archiveEnvelope,registryEnvelope,checkpoint){
 try{
  const a=archiveEnvelope.body,reg=registryEnvelope.body;
  if(archiveEnvelope.digest!==hash(a)||a.schema!=='security59_archive_v1'||
   a.production!==false||a.writeEnabled!==false||
   reg.schema!=='security59_registry_v1'||!Number.isSafeInteger(reg.version)||
   reg.version<checkpoint.minimumVersion||
   (reg.version===checkpoint.minimumVersion&&hash(reg)!==checkpoint.acceptedHash)||
   !valid(reg,registryEnvelope.signature,pinnedRoot))return false;
  if(reg.version>checkpoint.minimumVersion&&reg.previousHash!==checkpoint.acceptedHash)return false;
  const unique=new Set(reg.keys.map(k=>k.role+':'+k.id));
  if(unique.size!==reg.keys.length)return false;
  const key=(role,id)=>{
   const matches=reg.keys.filter(k=>k.role===role&&k.id===id&&!k.revoked);
   return matches.length===1?matches[0].publicKey:null;
  };
  const p=key('publisher',a.publisherKeyId),w=key('witness',a.witnessKeyId);
  const s=a.source,r=a.receipt,cut=Date.parse(s.cutoff);
  if(!p||!w||p===w||s.gameId!=='synthetic-59'||s.status!=='scheduled'||
   s.awayGoalie.id===s.homeGoalie.id||
   Date.parse(s.kickoff)<=cut||
   [s.publishedAt,s.baseline.predictedAt,s.awayGoalie.value.fetchedAt,
    s.homeGoalie.value.fetchedAt,r.observedAt].some(t=>!Number.isFinite(Date.parse(t))||Date.parse(t)>cut)||
   Date.parse(s.publishedAt)>Date.parse(r.observedAt)||
   r.sourceHash!==hash(s)||r.sourceSignatureHash!==hash(a.sourceSignature)||
   !valid(s,a.sourceSignature,p)||!valid(r,a.receiptSignature,w))return false;
  return canonical(a.records)===canonical(compute(s));
 }catch{return false;}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'security59-'));
try{
 const archivePath=path.join(dir,'archive.json'),registryPath=path.join(dir,'registry.json'),
 checkpointPath=path.join(dir,'checkpoint.json');
 const write=(file,v)=>fs.writeFileSync(file,canonical(v));
 const envelope=a=>({body:a,digest:hash(a)});
 write(archivePath,envelope(archive));
 write(registryPath,signedRegistry(registry2));
 write(checkpointPath,{minimumVersion:2,acceptedHash:hash(registry2)});
 const reload=()=>verify(JSON.parse(fs.readFileSync(archivePath,'utf8')),
  JSON.parse(fs.readFileSync(registryPath,'utf8')),
  JSON.parse(fs.readFileSync(checkpointPath,'utf8')));
 assert(reload(),'reloaded archive with pinned signed registry');
 write(registryPath,signedRegistry(registry1));
 assert(!reload(),'signed registry rollback rejected');
 write(registryPath,signedRegistry(registry2));
 const forgedReg={...registry2,keys:registry2.keys.map(k=>k.role==='publisher'?{...k,publicKey:pub(attacker.publicKey)}:k)};
 write(registryPath,{body:forgedReg,signature:sign(forgedReg,attacker.privateKey)});
 assert(!reload(),'forged trust registry rejected');
 write(registryPath,signedRegistry(registry2));
 const forged={...archive,source:{...source,baseline:{...source.baseline,away:9}}};
 forged.sourceSignature=sign(forged.source,attacker.privateKey);
 write(archivePath,envelope(forged));
 assert(!reload(),'forged archive rejected even with matching checksum');
 const changed={...archive,records:archive.records.map((r,i)=>i===0?{...r,away:99}:r)};
 write(archivePath,envelope(changed));
 assert(!reload(),'changed output rejected despite matching checksum');
 write(archivePath,envelope(archive));
 assert(reload(),'restored archive verifies');
 console.log('PASS SECURITY-59 persisted archive and pinned signed registry rollback gate');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
