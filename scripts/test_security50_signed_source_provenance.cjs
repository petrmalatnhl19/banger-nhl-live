"use strict";
/* SECURITY-50: offline provenance binding with independently signed source receipts.
 * Synthetic fixtures; keys generated per test, not a production trust authority.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const canonical=v=>Array.isArray(v)?"["+v.map(canonical).join(",")+"]":v&&typeof v==="object"?"{"+Object.keys(v).sort().map(k=>JSON.stringify(k)+":"+canonical(v[k])).join(",")+"}":JSON.stringify(v);
const hash=v=>crypto.createHash("sha256").update(canonical(v)).digest("hex");
const {publicKey,privateKey}=crypto.generateKeyPairSync("ed25519");
const other=crypto.generateKeyPairSync("ed25519");
const cutoff="2026-11-16T19:00:00Z";
const source={sourceId:"synthetic-goalie-feed",gameId:"game-50",publishedAt:"2026-11-16T18:10:00Z",observedAt:"2026-11-16T18:05:00Z",goalieId:"8471234",gsaxPer100Shots:1.2};
function signReceipt(record,key=privateKey){
 const envelope={schema:"security50_source_receipt_v1",source:structuredClone(record),
   verifiedAt:"2026-11-16T18:12:00Z",receivedAt:"2026-11-16T18:13:00Z"};
 return {envelope,signature:crypto.sign(null,Buffer.from(canonical(envelope)),key).toString("base64")};
}
function verify(receipt,{key=publicKey,gameId="game-50",asOf=cutoff}={}){
 if(!receipt||!receipt.envelope||!receipt.envelope.source||typeof receipt.signature!=="string")return false;
 const e=receipt.envelope,s=e.source,at=Date.parse(asOf);
 if(e.schema!=="security50_source_receipt_v1"||s.gameId!==gameId||!s.sourceId||
   !Number.isFinite(at)||!Number.isFinite(Date.parse(s.observedAt)))return false;
 for(const timestamp of [s.observedAt,s.publishedAt,e.verifiedAt,e.receivedAt]){
   if(typeof timestamp!=="string"||!Number.isFinite(Date.parse(timestamp))||Date.parse(timestamp)>at)return false;
 }
 if(Date.parse(s.observedAt)>Date.parse(s.publishedAt)||
   Date.parse(s.publishedAt)>Date.parse(e.verifiedAt)||
   Date.parse(e.verifiedAt)>Date.parse(e.receivedAt))return false;
 if(!/^[A-Za-z0-9+/]{86}==$/.test(receipt.signature))return false;
 try{return crypto.verify(null,Buffer.from(canonical(e)),key,Buffer.from(receipt.signature,"base64"));}
 catch{return false;}
}
function bind(receipt,gameId="game-50"){
 if(!verify(receipt,{gameId}))throw Error("untrusted_or_late_provenance");
 const sourceHash=hash(receipt.envelope.source);
 return {gameId,cutoff,sourceHash,receiptHash:hash(receipt.envelope),
   signature:receipt.signature,sourceId:receipt.envelope.source.sourceId,
   verifiedBeforeCutoff:true,production:false,persistable:false};
}
const signed=signReceipt(source),bound=bind(signed);
assert.equal(verify(signed),true);
assert.deepEqual(bind(signed),bound);
assert.equal(bound.sourceHash,hash(source));
assert.equal(verify(signed,{key:other.publicKey}),false);
assert.equal(verify(signed,{gameId:"other-game"}),false);
assert.equal(verify(signed,{asOf:"2026-11-16T18:11:00Z"}),false);
for(const field of ["goalieId","gsaxPer100Shots","publishedAt"]){
 const bad=structuredClone(signed);
 bad.envelope.source[field]=field==="gsaxPer100Shots"?8:"changed";
 assert.equal(verify(bad),false,"tampering "+field);
}
const late=signReceipt({...source,publishedAt:"2026-11-16T19:01:00Z"});
assert.equal(verify(late),false);
const reordered=signReceipt({...source,observedAt:"2026-11-16T18:11:00Z",publishedAt:"2026-11-16T18:10:00Z"});
assert.equal(verify(reordered),false);
const invalid=structuredClone(signed);invalid.signature="not-base64";
assert.equal(verify(invalid),false);
const forged=signReceipt(source,other.privateKey);
assert.equal(verify(forged),false);
assert.throws(()=>bind(forged),/untrusted_or_late_provenance/);
assert.equal(bound.production,false);
assert.equal(bound.persistable,false);
console.log("PASS SECURITY-50 offline signed source provenance and cutoff binding");
