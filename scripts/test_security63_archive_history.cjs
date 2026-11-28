#!/usr/bin/env node
'use strict';
// SECURITY-63: archived experimental predictions bound to a signed append-only checkpoint chain.
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
const root=pair(),publisher=pair(),observer=pair(),machine=pair(),attacker=pair();
const rootKey=pub(root.publicKey),machineKey=pub(machine.publicKey);
const cutoff='2026-11-16T19:00:00Z';
const source={gameId:'synthetic-63',status:'scheduled',cutoff,kickoff:'2026-11-16T20:00:00Z',
 publishedAt:'2026-11-16T18:10:00Z',baseline:{away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'},
 awayGoalie:{id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}},
 homeGoalie:{id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}}};
const compute=s=>[0,0.005,0.02,0.03].map(coefficient=>{
 const r=calculateShadow({baseline:s.baseline,awayGoalie:s.awayGoalie,homeGoalie:s.homeGoalie,asOf:s.cutoff,coefficient});
 if(!r.available)throw Error('experimental engine unavailable');
 return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,production:false,persistable:false};
});
const signature=sign(source,publisher.privateKey);
const receipt={sourceHash:hash(source),sourceSignatureHash:hash(signature),observedAt:'2026-11-16T18:45:00Z'};
const archive={schema:'security63_archive_v1',source,sourceSignature:signature,receipt,
 receiptSignature:sign(receipt,observer.privateKey),publisherKeyId:'publisher-v1',witnessKeyId:'observer-v1',
 records:compute(source),production:false,writeEnabled:false};
const registry={schema:'security63_registry_v1',version:1,keys:[
 {id:'publisher-v1',role:'publisher',publicKey:pub(publisher.publicKey),revoked:false},
 {id:'observer-v1',role:'witness',publicKey:pub(observer.publicKey),revoked:false}]};
const signedRegistry={body:registry,signature:sign(registry,root.privateKey)};
const make=(seq,previousHash,archiveHash)=>{const body={schema:'security63_checkpoint_v1',sequence:seq,previousHash,registryHash:hash(registry),archiveHash};
 return {body,signature:sign(body,machine.privateKey)};};
const first=make(1,null,hash({fixture:'historical-archive'}));
const second=make(2,hash(first),hash(archive));
const history=[first,second];
const anchor={sequence:2,headHash:hash(second)};
function verify(a,re,chain,pinned){
 try{
  if(a.schema!=='security63_archive_v1'||a.production!==false||a.writeEnabled!==false||
   !valid(re.body,re.signature,rootKey)||hash(re.body)!==hash(registry)||
   !Array.isArray(chain)||chain.length!==pinned.sequence||
   hash(chain[chain.length-1])!==pinned.headHash)return false;
  for(let i=0;i<chain.length;i++){
   const e=chain[i],b=e.body;
   if(b.schema!=='security63_checkpoint_v1'||b.sequence!==i+1||
    b.previousHash!==(i?hash(chain[i-1]):null)||
    b.registryHash!==hash(re.body)||!valid(b,e.signature,machineKey))return false;
  }
  if(chain[chain.length-1].body.archiveHash!==hash(a))return false;
  const get=(role,id)=>{
   const matches=re.body.keys.filter(k=>k.role===role&&k.id===id&&!k.revoked);
   return matches.length===1?matches[0].publicKey:null;
  };
  const p=get('publisher',a.publisherKeyId),w=get('witness',a.witnessKeyId);
  const s=a.source,r=a.receipt,cut=Date.parse(s.cutoff);
  if(!p||!w||p===w||s.gameId!=='synthetic-63'||s.status!=='scheduled'||
   s.awayGoalie.id===s.homeGoalie.id||!Number.isFinite(cut)||Date.parse(s.kickoff)<=cut||
   [s.publishedAt,s.baseline.predictedAt,s.awayGoalie.value.fetchedAt,
    s.homeGoalie.value.fetchedAt,r.observedAt].some(t=>!Number.isFinite(Date.parse(t))||Date.parse(t)>cut)||
   Date.parse(s.publishedAt)>Date.parse(r.observedAt)||
   r.sourceHash!==hash(s)||r.sourceSignatureHash!==hash(a.sourceSignature)||
   !valid(s,a.sourceSignature,p)||!valid(r,a.receiptSignature,w))return false;
  return canonical(a.records)===canonical(compute(s));
 }catch{return false;}
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'security63-'));
try{
 const local=path.join(dir,'local'),external=path.join(dir,'machine');fs.mkdirSync(local);fs.mkdirSync(external);
 const aPath=path.join(local,'archive.json'),rPath=path.join(local,'registry.json'),
 hPath=path.join(local,'history.json'),anchorPath=path.join(external,'anchor.json');
 const put=(p,v)=>fs.writeFileSync(p,canonical(v)),get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
 const reload=()=>verify(get(aPath),get(rPath),get(hPath),get(anchorPath));
 put(aPath,archive);put(rPath,signedRegistry);put(hPath,history);put(anchorPath,anchor);
 assert(reload(),'archived prediction and complete signed history verify after reload');
 put(hPath,[second]);assert(!reload(),'deleted first checkpoint rejected');
 put(hPath,[second,first]);assert(!reload(),'reordered checkpoints rejected');
 put(hPath,[first]);assert(!reload(),'truncated history rejected');
 put(hPath,history);
 const changed={...archive,records:archive.records.map((r,i)=>i===0?{...r,away:99}:r)};
 put(aPath,changed);assert(!reload(),'modified archived prediction rejected');
 put(aPath,archive);
 const fork=make(2,hash(first),hash({fixture:'different-archive'}));
 put(hPath,[first,fork]);assert(!reload(),'alternative signed fork rejected by retained anchor');
 put(hPath,history);
 const forged=structuredClone(history);forged[1].signature=sign(forged[1].body,attacker.privateKey);
 put(hPath,forged);assert(!reload(),'forged machine signature rejected');
 put(hPath,history);assert(reload(),'clean archive and history accepted');
 console.log('PASS SECURITY-63 archived experimental predictions linked to signed checkpoint history');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
