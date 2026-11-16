"use strict";
// SECURITY-47: real repository CORE 4.3 GSAx sensitivity function, synthetic inputs.
// Not calibrated, not persistable, no external network or production writes.
const assert=require("node:assert/strict");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const cutoff="2026-11-16T19:00:00Z";
const start="2026-11-16T20:00:00Z";
const baseline=Object.freeze({away:2.8,home:3.2,predictedAt:"2026-11-16T17:00:00Z"});
const evidence=(value,fetchedAt)=>({available:true,value:{gsaxPer100Shots:value,shotsAgainst:200,fetchedAt}});
const away=evidence(2,"2026-11-16T18:00:00Z");
const home=evidence(-1,"2026-11-16T18:30:00Z");
function run({asOf=cutoff,actualStart=start,status="scheduled",awayGoalie=away,homeGoalie=home}={}){
  if(status!=="scheduled"||!Number.isFinite(Date.parse(actualStart))||
      !Number.isFinite(Date.parse(asOf))||Date.parse(asOf)>=Date.parse(actualStart))
    return {available:false,reason:"not_verified_pregame",production:false};
  return calculateShadow({baseline,awayGoalie,homeGoalie,asOf});
}
const original=run();
assert.equal(original.available,true);
assert.equal(original.production,false);
assert.equal(original.calibrated,false);
assert.equal(original.expectedAwayGoals,2.82);
assert.equal(original.expectedHomeGoals,3.16);
assert.deepEqual(run(),original,"same frozen inputs must be deterministic");
const changed=run({homeGoalie:evidence(3,"2026-11-16T18:45:00Z")});
assert.equal(changed.available,true);
assert.notEqual(changed.expectedAwayGoals,original.expectedAwayGoals);
assert.deepEqual(run(),original,"original frozen calculation must remain unchanged");
assert.equal(run({homeGoalie:evidence(3,"2026-11-16T19:05:00Z")}).reason,"goalie_snapshot_after_asof");
assert.equal(run({awayGoalie:null}).reason,"missing_away_goalie_gsax");
assert.equal(run({status:"live"}).reason,"not_verified_pregame");
assert.equal(run({actualStart:"2026-11-16T18:59:00Z"}).reason,"not_verified_pregame");
assert.equal(run({actualStart:"invalid"}).reason,"not_verified_pregame");
console.log("PASS SECURITY-47 real uncalibrated CORE 4.3 sensitivity integration (offline)");
