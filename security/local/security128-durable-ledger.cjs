"use strict";
// SECURITY-128: disposable single-host file ledger prototype. NOT production storage.
const fs=require("node:fs"),path=require("node:path");
const {verify}=require("./security126-signed-snapshot.cjs");
const {TRUST}=require("./security125-timestamp-provenance.cjs");
const FAIL=Object.freeze({trust:TRUST.UNVERIFIED,rows:[],as_of:null,digest:null});
function createLedger({directory,publicKeys,activeKeyIds,revokedKeyIds=[]}={}){
 if(typeof directory!=="string"||!path.isAbsolute(directory))throw new TypeError("absolute disposable directory required");
 const allowed=new Set(activeKeyIds||[]),revoked=new Set(revokedKeyIds);
 const lock=path.join(directory,"ledger.lock"),file=path.join(directory,"ledger.json");
 fs.mkdirSync(directory,{recursive:true});
 function accept({snapshot,evidence,now}={}){
  if(!evidence||!allowed.has(evidence.key_id)||revoked.has(evidence.key_id))return FAIL;
  const checked=verify({snapshot,evidence,publicKeys,now});
  if(checked.trust!==TRUST.VERIFIED)return FAIL;
  // Exclusive creation serializes competing processes on one local filesystem.
  // Fail closed on contention; never remove another process's lock.
  try{fs.mkdirSync(lock);}catch(_error){return FAIL;}
  try{
   let state={latest:null,digests:[]};
   if(fs.existsSync(file)){
    state=JSON.parse(fs.readFileSync(file,"utf8"));
    if(!state||!Array.isArray(state.digests)||!(state.latest===null||Number.isSafeInteger(state.latest))||state.digests.some(x=>typeof x!=="string"||!/^[a-f0-9]{64}$/.test(x)))return FAIL;
   }
   const ms=Date.parse(checked.as_of);
   if(!Number.isSafeInteger(ms)||(state.latest!==null&&ms<=state.latest)||state.digests.includes(checked.digest))return FAIL;
   const next=JSON.stringify({latest:ms,digests:[...state.digests,checked.digest]});
   const tmp=path.join(directory,"ledger-"+process.pid+"-"+cryptoRandom()+".tmp");
   try{
    const fd=fs.openSync(tmp,"wx",0o600);
    try{fs.writeFileSync(fd,next);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    fs.renameSync(tmp,file);
    // fsync directory for best-effort local filesystem crash durability.
    const dirfd=fs.openSync(directory,"r");
    try{fs.fsyncSync(dirfd);}finally{fs.closeSync(dirfd);}
   }finally{try{fs.unlinkSync(tmp);}catch(_error){}}
   return checked;
  }catch(_error){return FAIL;}
  finally{try{fs.rmdirSync(lock);}catch(_error){}}
 }
 return Object.freeze({accept});
}
function cryptoRandom(){return require("node:crypto").randomBytes(8).toString("hex");}
module.exports={createLedger};
