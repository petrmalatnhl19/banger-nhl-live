"use strict";
// SECURITY-127: offline stateful anti-replay gate. Never use as production persistence.
const {verify}=require("./security126-signed-snapshot.cjs");
const {TRUST}=require("./security125-timestamp-provenance.cjs");
const FAIL=Object.freeze({trust:TRUST.UNVERIFIED,rows:[],as_of:null,digest:null});
function createGate({publicKeys,activeKeyIds,revokedKeyIds=[]}={}){
 const seen=new Set();
 let latest=-Infinity;
 const allowed=new Set(activeKeyIds||[]);
 const revoked=new Set(revokedKeyIds);
 function accept({snapshot,evidence,now}={}){
  if(!evidence||!allowed.has(evidence.key_id)||revoked.has(evidence.key_id))return FAIL;
  const result=verify({snapshot,evidence,publicKeys,now});
  if(result.trust!==TRUST.VERIFIED)return FAIL;
  const ms=Date.parse(result.as_of);
  if(!Number.isFinite(ms)||ms<=latest||seen.has(result.digest))return FAIL;
  // Record only after full cryptographic and freshness validation.
  latest=ms;seen.add(result.digest);
  return result;
 }
 return Object.freeze({accept});
}
module.exports={createGate};
