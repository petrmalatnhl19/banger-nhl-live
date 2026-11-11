"use strict";
/* Compose trusted archived source inputs with live-only shadow capture. No writes. */
const {assemblePregameSourceInput}=require("./core43_pregame_source_assembly.cjs");
const {capture}=require("./core43_capture_new_shadow.cjs");
const {adaptArchivedGsaxSnapshots}=require("./core43_archived_gsax_snapshot_adapter.cjs");
function prepareLiveShadowCapture(args={}){
 const adapted=args.goalieSnapshotRows?adaptArchivedGsaxSnapshots(args.goalieSnapshotRows,{asOf:args.asOf}):null;
 if(adapted&&!adapted.ready)return {captured:false,reason:adapted.reason,production:false,persistable:false};
 const assembly=assemblePregameSourceInput({...args,gsaxSnapshots:adapted?adapted.snapshots:args.gsaxSnapshots});
 if(!assembly.ready)return {captured:false,reason:assembly.reason,production:false,persistable:false};
 const result=capture({payload:assembly.payload,now:args.now});
 if(!result.captured)return result;
 return {...result,provenance:assembly.provenance,requiresIndependentAppendOnlyStorage:true};
}
module.exports={prepareLiveShadowCapture};
