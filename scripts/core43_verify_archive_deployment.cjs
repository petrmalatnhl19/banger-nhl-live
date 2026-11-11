"use strict";
/* Safe archive deployment diagnostics: no mutations, no inserts. */
const {fetchRows}=require("./core43_supabase_readonly_report.cjs");
async function verifyArchive({url,key,fetchImpl=fetch}={}){
 if(!key)throw Error("missing_server_credentials");
 const rows=await fetchRows({url,key,table:"nhl_core43_shadow_capture_archive",select:"game_id,model_version,predicted_at,frozen_at,kickoff_at,capture_sha256,production,experimental,archived_at",fetchImpl});
 const invalid=rows.filter(r=>r.production!==false||r.experimental!==true||!r.capture_sha256||!Number.isFinite(Date.parse(r.predicted_at))||!Number.isFinite(Date.parse(r.frozen_at))||!Number.isFinite(Date.parse(r.kickoff_at))||!Number.isFinite(Date.parse(r.archived_at))||Date.parse(r.predicted_at)>Date.parse(r.frozen_at)||Date.parse(r.frozen_at)>=Date.parse(r.kickoff_at)||Date.parse(r.archived_at)>=Date.parse(r.kickoff_at));
 return {mode:"archive_read_only_verification",archived:rows.length,invalid:invalid.length,valid:invalid.length===0,production:false};
}
if(require.main===module)verifyArchive({url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY}).then(r=>console.log(JSON.stringify(r,null,2))).catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={verifyArchive};
