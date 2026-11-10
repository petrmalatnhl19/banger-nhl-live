const assert=require("node:assert/strict");
const {projectedObservations:run}=require("./core43_projected_source_observations.cjs");
const asOf="2026-11-10T15:00:00Z";
const base={updatedAt:"2026-11-10T14:00:00Z",games:[
 {gameId:42,team:"DAL",goalieId:"8479979",goalie:"Example",status:"projected",source:"https://www.rotowire.com/hockey/starting-goalies.php"},
 {gameId:42,team:"NJD",goalieId:"1234567",goalie:"Other",status:"confirmed",source:"https://www.rotowire.com/hockey/starting-goalies.php"}]};
const result=run(base,{asOf});
assert.equal(result.available,true);
assert.equal(result.observations.length,1);
assert.equal(result.observations[0].probability,null);
assert.equal(result.observations[0].sourcePublishedAt,null);
assert.equal(result.observations[0].eligibleForProjectedCalculation,false);
assert.equal(run({...base,updatedAt:"2026-11-10T16:00:00Z"},{asOf}).reason,"snapshot_after_asof");
assert.equal(run({...base,updatedAt:"2026-11-10T12:00:00Z"},{asOf}).reason,"stale_snapshot");
const duplicate={...base,games:[base.games[0],{...base.games[0],goalieId:"9999999"}]};
assert.equal(run(duplicate,{asOf}).observations.length,0);
assert.equal(run(duplicate,{asOf}).conflictCount,1);
assert.equal(run({...base,games:[{...base.games[0],goalieId:null}]},{asOf}).observations.length,0);
console.log("CORE 4.3 projected source observations tests passed");
