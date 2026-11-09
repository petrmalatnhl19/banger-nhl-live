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
 // The GSAx sensitivity engine explicitly labels itself hypothetical, not a calibrated forecast.
 // Never allow its output to be relabelled as a valid archived prediction.
 const source=JSON.stringify({engineVersion:computed.engineVersion,inputSnapshot:computed.inputSnapshot}).toLowerCase();
 if(source.includes("gsax_sensitivity")||source.includes("shadow_compute")||source.includes("hypothetical"))throw Error("uncalibrated_shadow_not_a_forecast");
 if(computed.calibrated===false||computed.persistable===false||computed.inputSnapshot.calibrated===false||computed.inputSnapshot.persistable===false)throw Error("nonpersistable_forecast");
 const row=buildRow({prediction,schedule,evidence,asOf,model,predictedAway:computed.expectedAwayGoals,
  predictedHome:computed.expectedHomeGoals,inputSnapshot:{
   ...computed.inputSnapshot,engineVersion:computed.engineVersion,
   calculationSource:"verified_experimental_computed_forecast",production:false
  }});
 return row;
}
module.exports={buildComputedRevision};
