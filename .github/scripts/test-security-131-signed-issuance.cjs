"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const {canonical,verify}=require("../../security/local/security131-signed-issuance.cjs");
const key=crypto.generateKeyPairSync("ed25519"),wrong=crypto.generateKeyPairSync("ed25519");
const now=Date.parse("2026-11-17T10:00:00Z");
const payload={version:1,audience:"banger_tv_offline",scope:"game:2026020335",sequence:1,digest:"a".repeat(64),issued_at:"2026-11-17T09:59:00Z",expires_at:"2026-11-17T10:01:00Z"};
const evidence={algorithm:"Ed25519",key_id:"synthetic",signature:crypto.sign(null,canonical(payload),key.privateKey).toString("base64")};
const args={payload,evidence,keys:{synthetic:key.publicKey.export({type:"spki",format:"pem"})},activeIds:["synthetic"],audience:"banger_tv_offline",now};
assert.equal(verify(args).verified,true);
function deny(x){assert.equal(verify({...args,...x}).verified,false);}
for(const change of [{sequence:2},{scope:"game:123"},{audience:"other"},{digest:"b".repeat(64)},{expires_at:"2026-11-17T10:02:00Z"},{issued_at:"2026-11-17T10:00:01Z"},{version:2}])deny({payload:{...payload,...change}});
deny({audience:"wrong"});deny({now:Date.parse("2026-11-17T10:02:00Z")});
deny({now:Date.parse("2026-11-17T09:58:00Z")});
deny({revokedIds:["synthetic"]});deny({activeIds:[]});
deny({keys:{synthetic:wrong.publicKey.export({type:"spki",format:"pem"})}});
deny({evidence:{...evidence,signature:"a".repeat(88)}});
deny({payload:{...payload,private_token:"ignored"}});
assert.throws(()=>canonical({...payload,sequence:0}));
console.log("SECURITY-131 synthetic signed issuance, expiry, audience, revocation, tampering PASS");
