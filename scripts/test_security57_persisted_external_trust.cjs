#!/usr/bin/env node
'use strict';
// SECURITY-57: persistent archive with separately pinned synthetic trust registry.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {calculateShadow}=require('./core43_gsax_sensitivity.cjs');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const check=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const pub=k=>k.export({format:'pem',type:'spki'});
const publisher=crypto.generateKeyPairSync('ed25519');
const witness=crypto.generateKeyPairSync('ed25519');
const attacker=crypto.generateKeyPairSync('ed25519');
const cutoff='2026-11-16T19:00:00Z';
const source={gameId:'synthetic-57',status:'scheduled',cutoff,kickoff:'2026-11-16T20:00:00Z',
 publishedAt:'2026-11-16T18:20:00Z',baseline:{away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'},
 awayGoalie:{id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}},
 homeGoalie:{id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}}};
const sourceSignature=sign(source,publisher.privateKey);
const receipt={sourceHash:hash(source),sourceSignatureHash:hash(sourceSignature),observedAt:'2026-11-16T18:45:00Z'};
const records=[0,0.005,0.02,0.03].map(coefficient=>{
 const r=calculateShadow({baseline:source.baseline,awayGoalie:source.awayGoalie,
  homeGoalie:source.homeGoalie,asOf:cutoff,coefficient});
 assert(r.available,'experimental engine must return results');
 return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,production:false,persistable:false};
});
const archive={schema:'security57_archive_v1',source,sourceSignature,publisherKeyId:'publisher-v1',
 receipt,receiptSignature:sign(receipt,witness.privateKey),witnessKeyId:'witness-v1',records,
 production:false,writeEnabled:false,
 // Archive keys are intentionally untrusted; verification must ignore them.
 publisherPublicKey:pub(publisher.publicKey),witnessPublicKey:pub(witness.publicKey)};
const trust={schema:'security57_trust_v1',keys:[
 {id:'publisher-v1',role:'publisher',publicKey:pub(publisher.publicKey),validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-01T00:00:00Z',revoked:false},
 {id:'witness-v1',role:'witness',publicKey:pub(witness.publicKey),validFrom:'2026-11-01T00:00:00Z',validUntil:'2026-12-01T00:00:00Z',revoked:false}]};
function verify(a,registry){
 try{
  if(a.schema!=='security57_archive_v1'||registry.schema!=='security57_trust_v1'||
   a.production!==false||a.writeEnabled!==false)return false;
  const s=a.source,receipt=a.receipt,t=Date.parse(receipt.observedAt),cut=Date.parse(s.cutoff);
  const times=[s.publishedAt,s.baseline.predictedAt,s.awayGoalie.value.fetchedAt,
   s.homeGoalie.value.fetchedAt,receipt.observedAt];
  if(s.gameId!=='synthetic-57'||s.status!=='scheduled'||s.awayGoalie.id===s.homeGoalie.id||
   !Number.isFinite(cut)||!Number.isFinite(t)||Date.parse(s.kickoff)<=cut||
   times.some(x=>!Number.isFinite(Date.parse(x))||Date.parse(x)>cut)||
   Date.parse(s.publishedAt)>t)return false;
  const lookup=(id,role)=>{
   const matches=registry.keys.filter(k=>k.id===id&&k.role===role&&!k.revoked);
   if(matches.length!==1)return null;
   const k=matches[0];
   return Date.parse(k.validFrom)<=t&&t<Date.parse(k.validUntil)?k.publicKey:null;
  };
  const p=lookup(a.publisherKeyId,'publisher'),w=lookup(a.witnessKeyId,'witness');
  if(!p||!w||p===w||receipt.sourceHash!==hash(s)||
   receipt.sourceSignatureHash!==hash(a.sourceSignature)||
   !check(s,a.sourceSignature,p)||!check(receipt,a.receiptSignature,w))return false;
  const expected=[0,0.005,0.02,0.03].map(coefficient=>{
   const r=calculateShadow({baseline:s.baseline,awayGoalie:s.awayGoalie,homeGoalie:s.homeGoalie,
    asOf:s.cutoff,coefficient});
   if(!r.available)throw Error('unavailable engine');
   return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,
    production:false,persistable:false};
  });
  return canonical(a.records)===canonical(expected);
 }catch{return false;}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'security57-'));
try{
 const archivePath=path.join(dir,'archive.json'),trustPath=path.join(dir,'trusted-keys.json');
 fs.writeFileSync(archivePath,canonical({body:archive,digest:hash(archive)}));
 fs.writeFileSync(trustPath,canonical(trust));
 function reload(){
  const stored=JSON.parse(fs.readFileSync(archivePath,'utf8'));
  const pinned=JSON.parse(fs.readFileSync(trustPath,'utf8'));
  return stored.digest===hash(stored.body)&&verify(stored.body,pinned);
 }
 assert(reload(),'reopened archive and external trust registry must verify');
 const original=fs.readFileSync(archivePath,'utf8');
 const forged={...archive,source:{...source,baseline:{...source.baseline,away:9}},
  publisherPublicKey:pub(attacker.publicKey)};
 forged.sourceSignature=sign(forged.source,attacker.privateKey);
 const forgedReceipt={...receipt,sourceHash:hash(forged.source),
  sourceSignatureHash:hash(forged.sourceSignature)};
 forged.receipt=forgedReceipt;forged.receiptSignature=sign(forgedReceipt,witness.privateKey);
 fs.writeFileSync(archivePath,canonical({body:forged,digest:hash(forged)}));
 assert(!reload(),'re-signed archive with substituted public key must fail');
 fs.writeFileSync(archivePath,original);
 const mutated={...archive,records:archive.records.map((r,i)=>i===0?{...r,home:99}:r)};
 fs.writeFileSync(archivePath,canonical({body:mutated,digest:hash(mutated)}));
 assert(!reload(),'changed predictions even with recomputed digest must fail');
 fs.writeFileSync(archivePath,original);
 const oldTrust=fs.readFileSync(trustPath,'utf8');
 fs.writeFileSync(trustPath,canonical({...trust,keys:trust.keys.map(k=>k.role==='publisher'?{...k,revoked:true}:k)}));
 assert(!reload(),'revoked pinned key must fail');
 fs.writeFileSync(trustPath,oldTrust);
 assert(reload(),'restored archive and trust registry must verify');
 console.log('PASS SECURITY-57 persisted signed four-variant archive with independent pinned synthetic trust');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
