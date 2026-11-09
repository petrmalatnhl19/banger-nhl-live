"use strict";
/* Pure, read-only diagnostics. Never invokes writeRow or alters archives. */
const {buildRow}=require("./write_core43_revision.cjs");
function auditRevisionWriteReadiness({payloads=[],existingRevisions=[]}={}){
 const existing=new Set(existingRevisions.map(r=>[r.game_id,r.model,r.revision_kind,r.predicted_at].join("|")));
 const candidates=new Set(),results=[];
 for(const payload of payloads){
  try{
   const row=buildRow(payload);
   const key=[row.game_id,row.model,row.revision_kind,row.predicted_at].join("|");
   const reason=existing.has(key)?"already_archived":candidates.has(key)?"duplicate_candidate":null;
   if(!reason)candidates.add(key);
   results.push({gameId:row.game_id,eligible:!reason,reason:reason||"ready_for_explicit_review",model:row.model,asOf:row.predicted_at});
  }catch(e){
   results.push({gameId:payload?.schedule?.game_id??null,eligible:false,reason:String(e.message||e)});
  }
 }
 return {mode:"read_only",total:results.length,ready:results.filter(x=>x.eligible).length,blocked:results.filter(x=>!x.eligible).length,results};
}
module.exports={auditRevisionWriteReadiness};
