"use strict";
// SECURITY-126: offline Ed25519 integrity verifier. No production trust anchors or signing keys.
const crypto=require("node:crypto");
const {prepare}=require("./security123-public-contract.cjs");
const {check,VERSION}=require("./security118-tv-freshness.cjs");
const {attest,TRUST}=require("./security125-timestamp-provenance.cjs");
const DOMAIN="BANGER-TV-PUBLIC-SNAPSHOT-V1\n";
function canonical(snapshot){
 const s=prepare(snapshot);
 // Contract projection fixes field order, rejects duplicate/orphan games and invalid fields.
 // Sort both batches so their source ordering does not change the signed content.
 const metadata=[...s.metadata].sort((a,b)=>a.game_id-b.game_id);
 const predictions=[...s.predictions].sort((a,b)=>a.game_id-b.game_id);
 return Buffer.from(DOMAIN+JSON.stringify({version:s.version,metadata_as_of:s.metadata_as_of,predictions_as_of:s.predictions_as_of,metadata,predictions}),"utf8");
}
function digest(snapshot){return crypto.createHash("sha256").update(canonical(snapshot)).digest("hex");}
function verify({snapshot,evidence,publicKeys,now,maxAgeMs=300000,maxSkewMs=60000}={}){
 const failure=Object.freeze({trust:TRUST.UNVERIFIED,rows:[],as_of:null,digest:null});
 try{
  if(!evidence||typeof evidence!=="object"||Array.isArray(evidence)||evidence.algorithm!=="Ed25519"||typeof evidence.key_id!=="string"||!/^[-a-zA-Z0-9_]{1,64}$/.test(evidence.key_id)||typeof evidence.signature!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(evidence.signature))return failure;
  if(!publicKeys||!Object.hasOwn(publicKeys,evidence.key_id))return failure;
  const key=crypto.createPublicKey(publicKeys[evidence.key_id]);
  if(key.asymmetricKeyType!=="ed25519")return failure;
  const bytes=canonical(snapshot);
  const signature=Buffer.from(evidence.signature,"base64");
  if(signature.length!==64||signature.toString("base64")!==evidence.signature)return failure;
  if(!crypto.verify(null,bytes,key,signature))return failure;
  const fresh=check({...snapshot,metadataVersion:VERSION,predictionsVersion:VERSION,now,maxAgeMs,maxSkewMs});
  const provenance=attest({metadataAsOf:snapshot.metadataAsOf,predictionsAsOf:snapshot.predictionsAsOf,version:VERSION,evidence,verifyEvidence:()=>true});
  if(provenance.trust!==TRUST.VERIFIED)return failure;
  return Object.freeze({trust:TRUST.VERIFIED,rows:fresh.rows,as_of:fresh.as_of,digest:crypto.createHash("sha256").update(bytes).digest("hex")});
 }catch(_error){return failure;}
}
module.exports={canonical,digest,verify};
