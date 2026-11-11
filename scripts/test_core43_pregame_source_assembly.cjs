"use strict";
const assert=require("node:assert/strict");
const {assemblePregameSourceInput:assemble}=require("./core43_pregame_source_assembly.cjs");
const asOf="2026-11-11T12:00:00Z",now="2026-11-11T12:01:00Z";
const args={gameId:123,awayTeam:"DAL",homeTeam:"NYR",asOf,now,
 schedules:[{game_id:123,away_team:"DAL",home_team:"NYR",kickoff_at:"2026-11-11T23:00:00Z",fetched_at:"2026-11-11T11:50:00Z"}],
 predictions:[{game_id:123,away_team:"DAL",home_team:"NYR",core42_predicted_at:"2026-11-11T11:55:00Z",core42_away:3,core42_home:2.8}],
 gsaxSnapshots:[{archiveId:"snapshot-123",fetchedAt:"2026-11-11T11:45:00Z",rows:[{playerId:"8471234"}]}]};
const ok=assemble(args);
assert.equal(ok.ready,true);
assert.equal(ok.payload.baseline.away,3);
assert.equal(ok.provenance.gsaxArchiveId,"snapshot-123");
assert.equal(assemble({...args,now:"2026-11-11T12:07:00Z"}).reason,"invalid_live_context");
assert.equal(assemble({...args,schedules:[{...args.schedules[0],fetched_at:"2026-11-11T12:02:00Z"}]}).reason,"missing_pregame_schedule");
assert.equal(assemble({...args,gsaxSnapshots:[{...args.gsaxSnapshots[0],fetchedAt:"2026-11-11T12:02:00Z"}]}).reason,"missing_archived_pregame_gsax");
assert.equal(assemble({...args,gsaxSnapshots:[{...args.gsaxSnapshots[0],archiveId:""}]}).reason,"missing_gsax_archive_provenance");
assert.equal(assemble({...args,predictions:[{...args.predictions[0],core42_predicted_at:"2026-11-11T12:02:00Z"}]}).reason,"invalid_core42_baseline");
assert.equal(assemble({...args,predictions:[...args.predictions,...args.predictions]}).reason,"ambiguous_baseline_archive");
assert.equal(assemble({...args,schedules:[...args.schedules,{...args.schedules[0],kickoff_at:"2026-11-12T00:00:00Z"}]}).reason,"conflicting_schedule_kickoff");
console.log("CORE 4.3 source assembly gate tests passed");
