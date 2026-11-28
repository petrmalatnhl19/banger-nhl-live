"use strict";
// SECURITY-131: synthetic signed issuance envelope policy. NOT production trust infrastructure.
const crypto=require("node:crypto");
const DOMAIN="BANGER-ISSUANCE-V1\n";
const FAIL=Object.freeze({verified:false,scope:null,sequence:null,digest:null});
function canonical(p){
 if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).sort().join(",")!=="audience,digest,expires_at,issued_at,scope,sequence,version")throw Error("invalid envelope");
 if(p.version!==1||typeof p.scope!=="string"||!/^game:[0-9]{1,12}$/.test(p.scope)||!Number.isSafeInteger(p.sequence)||p.sequence<=0||typeof p.digest!=="string"||!/^[a-f0-9]{64}$/.test(p.digest)||typeof p.audience!=="string"||!/^[-a-z0-9_]{1,48}$/.test(p.audience))throw Error("invalid fields");
 for(const t of [p.issued_at,p.expires_at])if(typeof t!=="string"||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$/.test(t)||!Number.isFinite(Date.parse(t))||new Date(Date.parse(t)).toISOString()!==t.replace("Z",".000Z"))throw Error("invalid time");
 return Buffer.from(DOMAIN+JSON.stringify({version:p.version,audience:p.audience,scope:p.scope,sequence:p.sequence,digest:p.digest,issued_at:p.issued_at,expires_at:p.expires_at}),"utf8");
}
function verify({payload,evidence,keys,activeIds,revokedIds=[],audience,now,maxLifetimeMs=300000}={}){
 try{
  if(!evidence||evidence.algorithm!=="Ed25519"||typeof evidence.key_id!=="string"||!activeIds?.includes(evidence.key_id)||revokedIds.includes(evidence.key_id)||!Object.hasOwn(keys||{},evidence.key_id)||typeof evidence.signature!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(evidence.signature))return FAIL;
  const bytes=canonical(payload),key=crypto.createPublicKey(keys[evidence.key_id]),sig=Buffer.from(evidence.signature,"base64");
  if(key.asymmetricKeyType!=="ed25519"||sig.length!==64||sig.toString("base64")!==evidence.signature||!crypto.verify(null,bytes,key,sig))return FAIL;
  const issued=Date.parse(payload.issued_at),expiry=Date.parse(payload.expires_at);
  if(payload.audience!==audience||!Number.isFinite(now)||issued>now||expiry<=now||expiry<=issued||expiry-issued>maxLifetimeMs)return FAIL;
  return Object.freeze({verified:true,scope:payload.scope,sequence:payload.sequence,digest:payload.digest});
 }catch(_error){return FAIL;}
}
module.exports={canonical,verify};
