#!/usr/bin/env node
'use strict';
// SECURITY-61: automated machine-witness checkpoint gates archived predictions.
// This is an offline synthetic fixture; no people, external service or production data.
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
const check=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const root=pair(),machine=pair(),publisher=pair(),observer=pair(),attacker=pair();
const pinnedRoot=pub(root.publicKey),pinnedMachine=pub(machine.publicKey);
const source={gameId:'synthetic-61',status:'scheduled',cutoff:'2026-11-16T19:00:00Z',
 kickoff:'2026-11-16T20:00:00Z',publishedAt:'2026-11-16T18:10:00Z',
 baseline:{away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'},
 awayGoalie:{id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}},
 homeGoalie:{id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}}};
const compute=s=>[0,0.005,0.02,0.03].map(coefficient=>{
 const r=calculateShadow({baseline:s.baseline,awayGoalie:s.awayGoalie,homeGoalie:s.homeGoalie,asOf:s.cutoff,coefficient});
 if(!r.available)throw Error('experimental engine unavailable');
 return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,production:false,persistable:false};
});
const sourceSignature=sign(source,publisher.privateKey);
const receipt={sourceHash:hash(source),sourceSignatureHash:hash(sourceSignature),observedAt:'2026-11-16T18:45:00Z'};
const archive={schema:'security61_archive_v1',source,sourceSignature,publisherKeyId:'publisher-v1',
 receipt,receiptSignature:sign(receipt,observer.privateKey),witnessKeyId:'observer-v1',
 records:compute(source),production:false,writeEnabled:false};
const keys=[{id:'publisher-v1',role:'publisher',publicKey:pub(publisher.publicKey),revoked:false},
 {id:'observer-v1',role:'witness',publicKey:pub(observer.publicKey),revoked:false}];
const oldRegistry={schema:'security61_registry_v1',version:1,previousHash:null,keys};
const registry={...oldRegistry,version:2,previousHash:hash(oldRegistry)};
const registryEnvelope=r=>({body:r,signature:sign(r,root.privateKey)});
const machineCheckpoint={schema:'security61_machine_checkpoint_v1',version:2,registryHash:hash(registry),archiveHash:hash(archive)};
const machineEnvelope=c=>({body:c,signature:sign(c,machine.privateKey)});
function verify(ae,re,me){
 try{
  const a=ae.body,r=re.body,m=me.body;
  if(ae.digest!==hash(a)||a.schema!=='security61_archive_v1'||a.production!==false||
   a.writeEnabled!==false||r.schema!=='security61_registry_v1'||
   m.schema!=='security61_machine_checkpoint_v1'||
   !check(r,re.signature,pinnedRoot)||!check(m,me.signature,pinnedMachine)||
   r.version!==m.version||hash(r)!==m.registryHash||hash(a)!==m.archiveHash||
   !Number.isSafeInteger(r.version)||r.version<2||r.previousHash!==hash(oldRegistry))return false;
  const keysFor=(role,id)=>{
   const matches=r.keys.filter(k=>k.role===role&&k.id===id&&!k.revoked);
   return matches.length===1?matches[0].publicKey:null;
  };
  const p=keysFor('publisher',a.publisherKeyId),w=keysFor('witness',a.witnessKeyId);
  const s=a.source,t=a.receipt,cut=Date.parse(s.cutoff);
  if(!p||!w||p===w||s.gameId!=='synthetic-61'||s.status!=='scheduled'||
   s.awayGoalie.id===s.homeGoalie.id||!Number.isFinite(cut)||Date.parse(s.kickoff)<=cut||
   [s.publishedAt,s.baseline.predictedAt,s.awayGoalie.value.fetchedAt,s.homeGoalie.value.fetchedAt,t.observedAt]
    .some(x=>!Number.isFinite(Date.parse(x))||Date.parse(x)>cut)||
   Date.parse(s.publishedAt)>Date.parse(t.observedAt)||
   t.sourceHash!==hash(s)||t.sourceSignatureHash!==hash(a.sourceSignature)||
   !check(s,a.sourceSignature,p)||!check(t,a.receiptSignature,w))return false;
  return canonical(a.records)===canonical(compute(s));
 }catch{return false;}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'security61-'));
try{
 const local=path.join(dir,'local'),external=path.join(dir,'machine');
 fs.mkdirSync(local);fs.mkdirSync(external);
 const aPath=path.join(local,'archive.json'),rPath=path.join(local,'registry.json'),mPath=path.join(external,'checkpoint.json');
 const put=(p,v)=>fs.writeFileSync(p,canonical(v));
 const get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const archiveEnvelope=a=>({body:a,digest:hash(a)});
 const reload=()=>verify(get(aPath),get(rPath),get(mPath));
 put(aPath,archiveEnvelope(archive));put(rPath,registryEnvelope(registry));put(mPath,machineEnvelope(machineCheckpoint));
 assert(reload(),'archived four variants verified by machine witness');
 put(rPath,registryEnvelope(oldRegistry));
 assert(!reload(),'old signed registry rejected by machine witness');
 put(rPath,registryEnvelope(registry));
 const forged={...archive,records:archive.records.map((v,i)=>i===0?{...v,away:99}:v)};
 put(aPath,archiveEnvelope(forged));
 assert(!reload(),'tampered archive with recomputed digest rejected by witness');
 put(aPath,archiveEnvelope(archive));
 const bogus={...machineCheckpoint,archiveHash:hash(forged)};
 put(mPath,{body:bogus,signature:sign(bogus,attacker.privateKey)});
 assert(!reload(),'forged machine witness rejected');
 put(mPath,machineEnvelope(machineCheckpoint));
 assert(reload(),'reopened clean chain verifies');
 console.log('PASS SECURITY-61 machine witness gates signed registry and archived experimental predictions');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
