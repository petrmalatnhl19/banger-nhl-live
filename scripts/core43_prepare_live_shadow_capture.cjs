"use strict";
/* Compose trusted archived source inputs with live-only shadow capture. No writes. */
const {assemblePregameSourceInput}=require("./core43_pregame_source_assembly.cjs");
const {capture}=require("./core43_capture_new_shadow.cjs");
function prepareLiveShadowCapture(args={}){
 const assembly=assemblePregameSourceInput(args);
 if(!assembly.ready)return {captured:false,reason:assembly.reason,production:false,persistable:false};
 const result=capture({payload:assembly.payload,now:args.now});
 if(!result.captured)return result;
 return {...result,provenance:assembly.provenance,requiresIndependentAppendOnlyStorage:true};
}
module.exports={prepareLiveShadowCapture};
