#!/usr/bin/env python3
"""SECURITY-55: persist and revalidate a complete synthetic signed evidence bundle.
Only temporary SQLite; Node calls existing experimental calculator.
"""
import json,hashlib,sqlite3,subprocess,tempfile
from pathlib import Path

def canon(v): return json.dumps(v,sort_keys=True,separators=(",",":"),ensure_ascii=False)
def sha(v): return hashlib.sha256(canon(v).encode()).hexdigest()
JS=r"""
const crypto=require('node:crypto');
const {calculateShadow}=require('./scripts/core43_gsax_sensitivity.cjs');
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const signer=crypto.generateKeyPairSync('ed25519'),witness=crypto.generateKeyPairSync('ed25519');
const sign=(v,k)=>crypto.sign(null,Buffer.from(canonical(v)),k).toString('base64');
const verify=(v,s,k)=>crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));
const cutoff='2026-11-16T19:00:00Z';
const source={schema:'security55_source_v1',gameId:'synthetic-55',cutoff,
  kickoff:'2026-11-16T20:00:00Z',status:'scheduled',
  baseline:{away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'},
  awayGoalie:{id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}},
  homeGoalie:{id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}},
  publishedAt:'2026-11-16T18:42:00Z'};
const sourceSignature=sign(source,signer.privateKey);
const witnessRecord={schema:'security55_witness_v1',sourceHash:hash(source),
  sourceSignatureHash:hash(sourceSignature),observedAt:'2026-11-16T18:45:00Z'};
const witnessSignature=sign(witnessRecord,witness.privateKey);
const times=[source.publishedAt,source.baseline.predictedAt,source.awayGoalie.value.fetchedAt,
 source.homeGoalie.value.fetchedAt,witnessRecord.observedAt];
if(times.some(t=>Date.parse(t)>Date.parse(cutoff))||
 Date.parse(source.kickoff)<=Date.parse(cutoff)||source.status!=='scheduled')throw Error('late data');
if(!verify(source,sourceSignature,signer.publicKey)||!verify(witnessRecord,witnessSignature,witness.publicKey))throw Error('bad signatures');
const records=[0,0.005,0.02,0.03].map(coefficient=>{
 const r=calculateShadow({baseline:source.baseline,awayGoalie:source.awayGoalie,
  homeGoalie:source.homeGoalie,asOf:cutoff,coefficient});
 if(!r.available)throw Error('calculator unavailable');
 return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,
   production:false,persistable:false};
});
const bundle={schema:'security55_offline_v1',source,sourceSignature,witnessRecord,witnessSignature,
 sourcePublicKey:signer.publicKey.export({type:'spki',format:'pem'}),
 witnessPublicKey:witness.publicKey.export({type:'spki',format:'pem'}),
 sourceHash:hash(source),witnessHash:hash(witnessRecord),records,
 production:false,writeEnabled:false};
process.stdout.write(JSON.stringify(bundle));
"""
VERIFY_JS=r"""
const crypto=require('node:crypto');
const {calculateShadow}=require('./scripts/core43_gsax_sensitivity.cjs');
const fs=require('node:fs');
const a=JSON.parse(fs.readFileSync(0,'utf8'));
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const check=(v,s,k)=>{try{return crypto.verify(null,Buffer.from(canonical(v)),k,Buffer.from(s,'base64'));}catch{return false;}};
const s=a.source,w=a.witnessRecord,cutoff=Date.parse(s?.cutoff);
const times=[s?.publishedAt,s?.baseline?.predictedAt,s?.awayGoalie?.value?.fetchedAt,
 s?.homeGoalie?.value?.fetchedAt,w?.observedAt];
let ok=a.schema==='security55_offline_v1'&&a.production===false&&a.writeEnabled===false&&
 s?.gameId==='synthetic-55'&&s?.status==='scheduled'&&s?.awayGoalie?.id!==s?.homeGoalie?.id&&
 Number.isFinite(cutoff)&&Date.parse(s.kickoff)>cutoff&&
 times.every(t=>typeof t==='string'&&Number.isFinite(Date.parse(t))&&Date.parse(t)<=cutoff)&&
 Date.parse(s.publishedAt)<=Date.parse(w.observedAt)&&
 a.sourceHash===hash(s)&&w?.sourceHash===hash(s)&&
 w?.sourceSignatureHash===hash(a.sourceSignature)&&a.witnessHash===hash(w)&&
 check(s,a.sourceSignature,a.sourcePublicKey)&&check(w,a.witnessSignature,a.witnessPublicKey);
if(ok){
 const expected=[0,0.005,0.02,0.03].map(coefficient=>{
  const r=calculateShadow({baseline:s.baseline,awayGoalie:s.awayGoalie,homeGoalie:s.homeGoalie,asOf:s.cutoff,coefficient});
  if(!r.available)throw Error('engine unavailable');
  return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,engine:r.model,
   production:false,persistable:false};
 });
 ok=canonical(a.records)===canonical(expected);
}
process.exit(ok?0:1);
"""
def verify(bundle):
    return subprocess.run(["node","-e",VERIFY_JS],input=canon(bundle),text=True,
                          capture_output=True).returncode==0
bundle=json.loads(subprocess.run(["node","-e",JS],check=True,capture_output=True,text=True).stdout)
assert verify(bundle)
with tempfile.TemporaryDirectory(prefix="security55-") as directory:
    path=str(Path(directory)/"archive.sqlite")
    db=sqlite3.connect(path,isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("CREATE TABLE archive (game_id TEXT PRIMARY KEY, body TEXT NOT NULL, digest TEXT NOT NULL)")
    body=canon(bundle)
    db.execute("INSERT INTO archive VALUES (?,?,?)",("synthetic-55",body,sha(bundle)))
    db.close()
    db=sqlite3.connect(path)
    row=db.execute("SELECT game_id,body,digest FROM archive").fetchone()
    assert row[0]=="synthetic-55" and row[2]==sha(json.loads(row[1]))
    restored=json.loads(row[1])
    assert restored==bundle and verify(restored)
    assert len(restored["records"])==4
    altered=json.loads(row[1]);altered["records"][1]["away"]+=0.5
    assert not verify(altered)
    altered=json.loads(row[1]);altered["source"]["homeGoalie"]["value"]["gsaxPer100Shots"]=9
    assert not verify(altered)
    altered=json.loads(row[1]);altered["witnessRecord"]["observedAt"]="2026-11-16T19:01:00Z"
    assert not verify(altered)
    altered=json.loads(row[1]);altered["sourceSignature"]="forged"
    assert not verify(altered)
    db.close()
print("PASS SECURITY-55 persisted synthetic signed evidence and four-variant replay")
