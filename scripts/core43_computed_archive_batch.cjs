"use strict";
/* Deterministic fail-closed batch assembly. No database access or writes. */
const {buildComputedRevision}=require("./core43_computed_revision_adapter.cjs");
function prepareComputedArchiveBatch({predictions=[],schedules=[],evidence=[],computed=[],existingRevisions=[],asOf,model="core41"}={}){
 if(typeof asOf!=="string"||!Number.isFinite(Date.parse(asOf)))throw Error("invalid_asof");
 const keyed=(rows)=>{const m=new Map();for(const r of rows){const k=String(r?.game_id??r?.gameId??"");if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
 const bySchedule=keyed(schedules),byComputed=keyed(computed);
 const existing=new Set(existingRevisions.map(r=>[r.game_id,r.model,r.revision_kind,r.predicted_at].join("|")));
 const seen=new Set(),rows=[],rejected=[];
 for(const prediction of predictions){
  const id=String(prediction?.game_id??"");
  if(seen.has(id)){rejected.push({gameId:id,reason:"duplicate_archive_prediction"});continue;}
  seen.add(id);
  const ss=bySchedule.get(id)||[],cc=(byComputed.get(id)||[]).filter(c=>c.model===model);
  if(ss.length!==1){rejected.push({gameId:id,reason:ss.length?"ambiguous_schedule":"missing_schedule"});continue;}
  if(cc.length!==1){rejected.push({gameId:id,reason:cc.length?"ambiguous_computed_forecast":"missing_computed_forecast"});continue;}
  if(cc[0].computedAt!==asOf){rejected.push({gameId:id,reason:"computed_forecast_time_mismatch"});continue;}
  try{
   const row=buildComputedRevision({prediction,schedule:ss[0],evidence:evidence.filter(e=>String(e.game_id)===id),asOf,model,computed:cc[0]});
   const k=[row.game_id,row.model,row.revision_kind,row.predicted_at].join("|");
   if(existing.has(k)){rejected.push({gameId:id,reason:"already_archived"});continue;}
   rows.push(row);
  }catch(e){rejected.push({gameId:id,reason:String(e.message||e)});}
 }
 return {mode:"dry_run",persisted:false,prepared:rows.length,rejected:rejected.length,rows,rejections:rejected};
}
module.exports={prepareComputedArchiveBatch};
