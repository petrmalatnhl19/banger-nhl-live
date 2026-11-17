"use strict";
// SECURITY-118: offline freshness gate. Policy threshold is a test-only proposal.
const {join}=require("./security117-tv-public-join.cjs");
const VERSION="tv-public-v1";
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function check({metadata,predictions,metadataAsOf,predictionsAsOf,metadataVersion,predictionsVersion,now,maxAgeMs=300000,maxSkewMs=60000}={}){
 if(!Number.isFinite(now)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||!Number.isSafeInteger(maxSkewMs)||maxSkewMs<0)throw new TypeError("invalid freshness policy");
 if(metadataVersion!==VERSION||predictionsVersion!==VERSION)throw new TypeError("snapshot version mismatch");
 function stamp(value){
  if(typeof value!=="string"||!UTC.test(value))throw new TypeError("invalid UTC timestamp");
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().replace(".000Z","Z")!==value.replace(/\.000Z$/,"Z"))throw new TypeError("invalid UTC timestamp");
  if(ms>now)throw new TypeError("future snapshot");
  if(now-ms>maxAgeMs)throw new TypeError("stale snapshot");
  return ms;
 }
 const a=stamp(metadataAsOf),b=stamp(predictionsAsOf);
 if(Math.abs(a-b)>maxSkewMs)throw new TypeError("snapshot skew");
 const combined=join(metadata,predictions);
 if(!combined.complete)throw new TypeError("incomplete prediction snapshot");
 return Object.freeze({rows:combined.rows,as_of:new Date(Math.min(a,b)).toISOString(),snapshot_version:VERSION,complete:true});
}
module.exports={check,VERSION};
