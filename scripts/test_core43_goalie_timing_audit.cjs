"use strict";
const assert=require("node:assert/strict");
const {auditTiming}=require("./core43_goalie_timing_audit.cjs");
const p=(id,at)=>({game_id:id,core41_predicted_at:at});
const o=(id,status,observed,snapshot)=>({game_id:id,observed_status:status,observed_at:observed,source_snapshot_at:snapshot});
const e=(id,published,verified)=>({game_id:id,evidence_status:"confirmed",source_url:"https://example.org/goalie",source_published_at:published,verified_at:verified});
const at="2026-11-10T12:00:00Z";
const r=auditTiming({predictions:[p(1,at),p(2,at),p(3,null)],
 observations:[o(1,"projected","2026-11-10T11:30:00Z","2026-11-10T11:25:00Z"),o(2,"confirmed","2026-11-10T12:30:00Z","2026-11-10T12:20:00Z")],
 evidence:[e(1,"2026-11-10T11:00:00Z","2026-11-10T12:20:00Z"),e(2,"2026-11-10T11:00:00Z","2026-11-10T11:20:00Z")]});
assert.equal(r.counts.missingPredictionTime,1);
assert.equal(r.counts.pregameProjectedOnly,1);
assert.equal(r.counts.noPregameObservation,1);
assert.equal(r.counts.evidenceVerifiedAfterPrediction,1);
assert.equal(r.counts.evidenceReadyBeforePrediction,1);
assert.equal(r.games[0].latestObservationAgeMinutes,30);
assert.equal(r.games[1].observationStatus,"no_pregame_observation");
assert.equal(r.production,false);
console.log("CORE 4.3 goalie timing audit tests passed");
