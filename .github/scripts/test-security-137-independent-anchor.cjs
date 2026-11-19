"use strict";
const assert=require("node:assert/strict"),crypto=require("node:crypto");
const checkpoint=require("../../security/local/security136-signed-checkpoint.cjs");
const anchor=require("../../security/local/security137-independent-anchor.cjs");
const issuer=crypto.generateKeyPairSync("ed25519"),authority=crypto.generateKeyPairSync("ed25519");
const issuerKeys={issuer:issuer.publicKey.export({type:"spki",format:"pem"})},anchorKeys={authority:authority.publicKey.export({type:"spki",format:"pem"})};
function sign(bytes,pair,id){return {algorithm:"Ed25519",key_id:id,signature:crypto.sign(null,bytes,pair.privateKey).toString("base64")};}
const old={version:1,digest:"a".repeat(64),heads:{"game:2026020335":1}};
const current={version:1,digest:"b".repeat(64),heads:{"game:2026020335":2}};
const oldSig=sign(checkpoint.canonical(old),issuer,"issuer"),currentSig=sign(checkpoint.canonical(current),issuer,"issuer");
const oldAnchor={version:1,epoch:1,checkpoint_digest:anchor.fingerprint(old)},latest={version:1,epoch:2,checkpoint_digest:anchor.fingerprint(current)};
const oldAnchorSig=sign(anchor.canonical(oldAnchor),authority,"authority"),latestSig=sign(anchor.canonical(latest),authority,"authority");
function check(c,cs,a,as,minimum=2,extra={}){return anchor.verifyLatest({checkpoint:c,checkpointEvidence:cs,checkpointKeys:issuerKeys,checkpointActiveIds:["issuer"],anchor:a,anchorEvidence:as,anchorKeys,anchorActiveIds:["authority"],trustedMinimumEpoch:minimum,...extra});}
assert.equal(check(current,currentSig,latest,latestSig),true);
assert.equal(check(old,oldSig,latest,latestSig),false,"old checkpoint cannot match newest anchor");
assert.equal(check(old,oldSig,oldAnchor,oldAnchorSig),false,"old signed pair fails externally pinned epoch");
assert.equal(check(old,oldSig,oldAnchor,oldAnchorSig,1),true,"old signed pair accepted if independent epoch also rolled back");
assert.equal(check(current,currentSig,{...latest,epoch:3},latestSig),false);
assert.equal(check(current,currentSig,{...latest,checkpoint_digest:"f".repeat(64)},latestSig),false);
assert.equal(check(current,currentSig,latest,{...latestSig,signature:"A".repeat(88)}),false);
assert.equal(check(current,currentSig,latest,latestSig,2,{anchorRevokedIds:["authority"]}),false);
assert.equal(check(current,currentSig,latest,latestSig,3),false);
assert.equal(check(current,currentSig,latest,latestSig,undefined,{anchorActiveIds:[]}),false);
assert.equal(check(current,oldSig,latest,latestSig),false);
console.log("SECURITY-137 signed independent latest-anchor rollback and key policy PASS");
