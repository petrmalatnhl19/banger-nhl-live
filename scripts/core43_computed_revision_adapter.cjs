/* CORE 4.3 experimental computed-forecast adapter.
 * No synthetic goals, no recalculation and no production model writes.
 */
"use strict";
const {buildRow}=require("./write_core43_revision.cjs");
function buildComputedRevision({prediction,schedule,evidence,asOf,model="core41",computed}={}){
 if(!computed||typeof computed!=="object"||Array.isArray(computed))throw Error("missing_computed_forecast");
 if(computed.gameId!==prediction?.game_id||computed.model!==model)throw Error("computed_forecast_identity_mismatch");
 if(computed.computedAt!==asOf)throw Error("computed_forecast_time_mismatch");
 if(computed.production!==false||typeof computed.engineVersion!=="string"||!computed.engineVersion.trim())throw Error("unverified_engine_version");
 if(!computed.inputSnapshot||typeof computed.inputSnapshot!=="object"||Array.isArray(computed.inputSnapshot)||Object.keys(computed.inputSnapshot).length===0)throw Error("missing_computed_inputs");
 if(computed.inputSnapshot.asOf!==asOf)throw Error("input_snapshot_time_mismatch");
 const row=buildRow({prediction,schedule,evidence,asOf,model,predictedAway:computed.expectedAwayGoals,
  predictedHome:computed.expectedHomeGoals,inputSnapshot:{
   ...computed.inputSnapshot,engineVersion:computed.engineVersion,
   calculationSource:"verified_experimental_computed_forecast",production:false
  }});
 return row;
}
module.exports={buildComputedRevision};
