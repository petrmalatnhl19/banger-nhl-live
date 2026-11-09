const assert=require("node:assert/strict");
const {auditRevisionWriteReadiness:run}=require("./core43_revision_write_readiness.cjs");
assert.deepEqual([run().total,run().ready],[0,0]);
assert.equal(run({payloads:[{}]}).blocked,1);
assert.equal(run({payloads:[null]}).blocked,1);
assert.equal(run({payloads:[{schedule:{game_id:42}}]}).results[0].gameId,42);
console.log("CORE 4.3 revision write readiness diagnostics passed");
