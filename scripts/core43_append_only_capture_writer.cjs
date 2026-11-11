"use strict";
/* Explicitly enabled server-only append-only experimental archive writer. */
const crypto=require("node:crypto");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function prepareArchiveRow(result,{now=new Date().toISOString()}={}){
 if(!result||result.captured!==true||!result.record||!result.provenance||!valid(now))throw Error("unverified_capture");
 const r=result.record;
 if(r.schema!=="core43_shadow_capture_v1"||r.production!==false||r.persistable!==false||r.experimental!==true||r.calibrated!==false||r.frozenBeforeKickoff!==true||!valid(r.predictedAt)||!valid(r.frozenAt)||!valid(r.kickoffAt)||Date.parse(r.predictedAt)>Date.parse(r.frozenAt)||Date.parse(r.frozenAt)>=Date.parse(r.kickoffAt)||Date.parse(now)<Date.parse(r.frozenAt)||Date.parse(now)-Date.parse(r.frozenAt)>120000)throw Error("invalid_capture_provenance");
 if(!result.provenance.gsaxArchiveId||result.provenance.baselineModel!=="core42")throw Error("missing_source_provenance");
 const digest=crypto.createHash("sha256").update(JSON.stringify(r)).digest("hex");
 if(digest!==result.sha256)throw Error("capture_hash_mismatch");
 return {game_id:String(r.gameId),model_version:"core43_gsax_sensitivity_v0",predicted_at:r.predictedAt,frozen_at:r.frozenAt,kickoff_at:r.kickoffAt,capture_sha256:digest,source_archive_id:result.provenance.gsaxArchiveId,payload:r,production:false,experimental:true};
}
async function insertOnce({url,key,result,now,enabled=false,fetchImpl=fetch}={}){
 if(!enabled)throw Error("archive_writer_disabled");
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url||"")||!key)throw Error("missing_server_credentials");
 const row=prepareArchiveRow(result,{now});
 const response=await fetchImpl(url+"/rest/v1/nhl_core43_shadow_capture_archive",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=minimal"},body:JSON.stringify(row)});
 if(response.status===409)return {inserted:false,reason:"duplicate_capture",archive:"experimental_only"};
 if(response.status!==201)throw Error("append_only_archive_insert_failed_http_"+response.status);
 return {inserted:true,archive:"experimental_only",captureSha256:row.capture_sha256};
}
module.exports={prepareArchiveRow,insertOnce};
