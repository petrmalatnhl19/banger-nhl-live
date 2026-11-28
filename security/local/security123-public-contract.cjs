"use strict";
// SECURITY-123: offline public projection contract. No SQL deployment, privileges or API calls.
const {project}=require("./security116-tv-metadata.cjs");
const {join}=require("./security117-tv-public-join.cjs");
const {FIELDS}=require("./security113-tv-public-browser.js");
const {VERSION}=require("./security118-tv-freshness.cjs");
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
function validateTimestamp(value){
 if(typeof value!=="string"||!UTC.test(value))throw new TypeError("invalid UTC timestamp");
 const time=Date.parse(value);
 if(!Number.isFinite(time)||new Date(time).toISOString().replace(".000Z","Z")!==value.replace(/\.000Z$/,"Z"))throw new TypeError("invalid UTC timestamp");
 return value;
}
function prepare({metadata,predictions,metadataAsOf,predictionsAsOf,version=VERSION}={}){
 if(version!==VERSION)throw new TypeError("invalid contract version");
 validateTimestamp(metadataAsOf);validateTimestamp(predictionsAsOf);
 const games=project(metadata);
 const combined=join(games,predictions);
 if(!combined.complete)throw new TypeError("incomplete public batch");
 const rows=combined.rows.map(row=>{
  const out={};
  for(const field of FIELDS)out[field]=row[field];
  return Object.freeze(out);
 });
 return Object.freeze({
  version,metadata_as_of:metadataAsOf,predictions_as_of:predictionsAsOf,
  metadata:Object.freeze(games.map(g=>Object.freeze({...g}))),
  predictions:Object.freeze(rows)
 });
}
module.exports={prepare,validateTimestamp};
