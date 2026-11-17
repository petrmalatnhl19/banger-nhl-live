"use strict";
// SECURITY-121: offline-only end-to-end preview bridge; no production wiring or live credentials.
const {readPublic}=require("./security113-tv-public-browser.js");
const {renderModel}=require("./security120-tv-ui-gate.cjs");
const {VERSION}=require("./security118-tv-freshness.cjs");
const {STATES}=require("./security119-tv-failclosed-state.cjs");
const FAILURE=Object.freeze({mode:"public-preview",enabled:true,state:STATES.UNAVAILABLE,rows:[],message:"Data nejsou dostupná",as_of:null});
async function preview({enabled=false,endpoint,apikey,fetchImpl,metadata,metadataAsOf,predictionsAsOf,now,metadataVersion=VERSION,predictionsVersion=VERSION,signal}={}){
 if(enabled!==true)return renderModel();
 try{
  const predictions=await readPublic({mode:"public",endpoint,apikey,fetchImpl,signal});
  return renderModel({mode:"public-preview",snapshot:{metadata,predictions,metadataAsOf,predictionsAsOf,metadataVersion,predictionsVersion,now}});
 }catch(_error){
  // No fallback to private legacy APIs, cached snapshots or exception details.
  return {...FAILURE,rows:[]};
 }
}
module.exports={preview};
