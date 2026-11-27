"use strict";
/* RFC 8785 JSON Canonicalization Scheme for new CORE 4.3 captures.
 * Legacy V1 hashes remain JSON.stringify(record), with original insertion order.
 */
const crypto=require("node:crypto");
const VERSION="rfc8785-v2";
function canonicalize(value){
 const seen=new Set();
 const quote=s=>{
  for(let i=0;i<s.length;i++){
   const c=s.charCodeAt(i);
   if(c>=0xd800&&c<=0xdbff){const n=s.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))throw Error("invalid_unicode");}
   else if(c>=0xdc00&&c<=0xdfff)throw Error("invalid_unicode");
  }
  return JSON.stringify(s);
 };
 const visit=v=>{
  if(v===null||typeof v==="boolean"||typeof v==="string")return typeof v==="string"?quote(v):JSON.stringify(v);
  if(typeof v==="number"){if(!Number.isFinite(v))throw Error("invalid_number");return JSON.stringify(v);}
  if(typeof v!=="object")throw Error("invalid_json_value");
  if(seen.has(v))throw Error("cyclic_json");
  seen.add(v);
  let result;
  if(Array.isArray(v))result="["+v.map(visit).join(",")+"]";
  else {
   const keys=Object.keys(v).sort(); // ECMAScript UTF-16 code unit order, as required by JCS
   result="{"+keys.map(k=>quote(k)+":"+visit(v[k])).join(",")+"}";
  }
  seen.delete(v);return result;
 };
 return visit(value);
}
function hashRecord(record){
 const version=record&&record.serializationVersion;
 if(version!==undefined&&version!==VERSION)throw Error("unsupported_serialization_version");
 const serialized=version===VERSION?canonicalize(record):JSON.stringify(record);
 return crypto.createHash("sha256").update(serialized,"utf8").digest("hex");
}
module.exports={VERSION,canonicalize,hashRecord};
