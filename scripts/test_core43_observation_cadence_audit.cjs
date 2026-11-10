"use strict";
const assert=require("node:assert/strict");
const {auditCadence}=require("./core43_observation_cadence_audit.cjs");
const kickoff="2026-11-10T20:00:00Z";
const o=t=>({game_id:1,team_code:"DAL",observed_at:t,source_snapshot_at:t});
const r=auditCadence({schedules:[{game_id:1,kickoff_at:kickoff,fetched_at:"2026-11-10T12:00:00Z"}],
 observations:[o("2026-11-10T15:00:00Z"),o("2026-11-10T18:00:00Z"),o("2026-11-10T19:00:00Z"),o("2026-11-10T19:00:00Z"),o("2026-11-10T20:30:00Z")]});
assert.equal(r.gameTeamSeries,1);
assert.equal(r.gameTeamSeriesWithObservationsByWindow.last1h,1);
assert.equal(r.gapSamplesLast6h,2);
assert.equal(r.medianGapMinutes,60);
assert.equal(r.p90GapMinutes,180);
assert.equal(r.production,false);
console.log("CORE 4.3 cadence audit tests passed");
