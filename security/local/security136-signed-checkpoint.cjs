"use strict";
// SECURITY-136: signed checkpoint for synthetic offline SQLite restore validation.
const crypto=require("node:crypto");
const PREFIX="BANGER-SQLITE-CHECKPOINT-V1\n";
function canonical(p){
 if(!p||typeof p!=="object"||Array.isArray(p)||Object.keys(p).sort().join(",")!=="digest,heads,version"||p.version!==1||typeof p.digest!=="string"||!/^[a-f0-9]{64}$/.test(p.digest))throw Error("invalid checkpoint");
 if(!p.heads||typeof p.heads!=="object"||Array.isArray(p.heads)||Object.getPrototypeOf(p.heads)!==Object.prototype)throw Error("invalid heads");
 const entries=Object.entries(p.heads);
 if(entries.length===0||entries.length>1000||entries.some(([scope,seq])=>!/^game:[0-9]{1,12}$/.test(scope)||!Number.isSafeInteger(seq)||seq<=0))throw Error("invalid head entry");
 const sorted=Object.fromEntries(entries.sort(([a],[b])=>a.localeCompare(b,"en")));
 return Buffer.from(PREFIX+JSON.stringify({version:1,digest:p.digest,heads:sorted}),"utf8");
}
function verify({checkpoint,evidence,keys,activeIds,revokedIds=[]}={}){
 try{
  if(!evidence||evidence.algorithm!=="Ed25519"||typeof evidence.key_id!=="string"||!Array.isArray(activeIds)||!activeIds.includes(evidence.key_id)||revokedIds.includes(evidence.key_id)||!Object.hasOwn(keys||{},evidence.key_id)||typeof evidence.signature!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(evidence.signature))return null;
  const bytes=canonical(checkpoint),key=crypto.createPublicKey(keys[evidence.key_id]),sig=Buffer.from(evidence.signature,"base64");
  if(key.asymmetricKeyType!=="ed25519"||sig.length!==64||sig.toString("base64")!==evidence.signature||!crypto.verify(null,bytes,key,sig))return null;
  return Object.freeze({digest:checkpoint.digest,heads:Object.freeze({...checkpoint.heads})});
 }catch{return null;}
}
module.exports={canonical,verify};
