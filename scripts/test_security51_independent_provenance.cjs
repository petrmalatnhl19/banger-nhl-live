"use strict";
/* SECURITY-51: independently verifiable provenance gate, offline synthetic receipts.
 * Never infer real publication from an internally signed/backdated timestamp.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
const digest=v=>crypto.createHash("sha256").update(canonical(v)).digest("hex");
const publisher=crypto.generateKeyPairSync("ed25519");
const witness=crypto.generateKeyPairSync("ed25519");
const attacker=crypto.generateKeyPairSync("ed25519");
const cutoff="2026-11-16T19:00:00Z";
const record={gameId:"synthetic-51",sourceId:"publisher-a",goalieId:"A",value:1.5,claimedPublishedAt:"2026-11-16T18:10:00Z"};
const signed=(payload,key)=>crypto.sign(null,Buffer.from(canonical(payload)),key).toString("base64");
function receipt(observation=record,observedAt="2026-11-16T18:20:00Z"){
 const publisherSignature=signed(observation,publisher.privateKey);
 const witnessPayload={schema:"security51_witness_v1",sourceHash:digest(observation),
   publisherSignatureHash:digest(publisherSignature),observedAt};
 return {observation,publisherSignature,witnessPayload,witnessSignature:signed(witnessPayload,witness.privateKey)};
}
const trustedKeys={publisherA:publisher.publicKey,witnessA:witness.publicKey};
function verify(r,{publisherKey=trustedKeys.publisherA,witnessKey=trustedKeys.witnessA,asOf=cutoff,gameId="synthetic-51"}={}){
 if(!r||!r.observation||!r.witnessPayload||typeof r.publisherSignature!=="string"||typeof r.witnessSignature!=="string")
   return {ready:false,reason:"incomplete_chain"};
 const p=r.observation,w=r.witnessPayload,at=Date.parse(asOf),observed=Date.parse(w.observedAt),claimed=Date.parse(p.claimedPublishedAt);
 if(!p.sourceId||p.gameId!==gameId)return {ready:false,reason:"wrong_source_or_game"};
 if(!Number.isFinite(at)||!Number.isFinite(observed)||!Number.isFinite(claimed)||claimed>observed||observed>at)
   return {ready:false,reason:"no_pregame_independent_observation"};
 if(w.schema!=="security51_witness_v1"||w.sourceHash!==digest(p)||w.publisherSignatureHash!==digest(r.publisherSignature))
   return {ready:false,reason:"broken_evidence_chain"};
 try{
  if(!crypto.verify(null,Buffer.from(canonical(p)),publisherKey,Buffer.from(r.publisherSignature,"base64")))
   return {ready:false,reason:"publisher_signature_invalid"};
  if(!crypto.verify(null,Buffer.from(canonical(w)),witnessKey,Buffer.from(r.witnessSignature,"base64")))
   return {ready:false,reason:"witness_signature_invalid"};
 }catch{return {ready:false,reason:"signature_invalid"};}
 return {ready:true,sourceHash:digest(p),witnessHash:digest(w),independentlyObservedAt:w.observedAt,
   production:false,persistable:false};
}
const good=receipt();
assert.equal(verify(good).ready,true);
assert.deepEqual(verify(good),verify(good));
assert.equal(verify(good,{publisherKey:attacker.publicKey}).ready,false);
assert.equal(verify(good,{witnessKey:attacker.publicKey}).ready,false);
assert.equal(verify(good,{gameId:"other-game"}).ready,false);
assert.equal(verify(good,{asOf:"2026-11-16T18:19:00Z"}).ready,false);
const backdated=receipt({...record,claimedPublishedAt:"2026-11-16T17:00:00Z"},"2026-11-16T19:01:00Z");
assert.equal(verify(backdated).reason,"no_pregame_independent_observation");
const altered=structuredClone(good);altered.observation.value=100;
assert.equal(verify(altered).ready,false);
const forged=receipt();forged.witnessSignature=signed(forged.witnessPayload,attacker.privateKey);
assert.equal(verify(forged).ready,false);
const mismatched=structuredClone(good);mismatched.witnessPayload.sourceHash="0".repeat(64);
assert.equal(verify(mismatched).reason,"broken_evidence_chain");
const missing=structuredClone(good);delete missing.witnessSignature;
assert.equal(verify(missing).reason,"incomplete_chain");
assert.equal(verify(good).production,false);
console.log("PASS SECURITY-51 offline independent publisher/witness chain gate");
