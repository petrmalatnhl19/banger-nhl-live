"use strict";
const assert=require("node:assert/strict");
const {diagnoseGoalies}=require("./core43_goalie_readiness_diagnostics.cjs");
const at="2026-11-11T21:14:00Z";
const observations=[
 {game_id:1,team_code:"TBL",goalie_name:"Goalie A",observed_status:"projected",observed_at:"2026-11-11T20:00:00Z",source_snapshot_at:"2026-11-11T19:59:00Z"},
 {game_id:1,team_code:"BUF",goalie_name:"Goalie B",observed_status:"confirmed",observed_at:"2026-11-11T20:00:00Z",source_snapshot_at:"2026-11-11T19:59:00Z"},
 {game_id:1,team_code:"TBL",goalie_name:"Goalie C",observed_status:"confirmed",observed_at:"2026-11-11T23:00:00Z",source_snapshot_at:"2026-11-11T22:59:00Z"}
];
const identities=[
 {team_code:"TBL",goalie_name:"Goalie A",goalie_id:10,observed_at:"2026-11-11T19:00:00Z"},
 {team_code:"BUF",goalie_name:"Goalie B",goalie_id:20,observed_at:"2026-11-11T19:00:00Z"}
];
const starterEvidence=[{game_id:1,team_code:"BUF",goalie_id:20,evidence_status:"confirmed",source_published_at:"2026-11-11T20:00:00Z",verified_at:"2026-11-11T20:30:00Z"}];
const result=diagnoseGoalies({gameId:1,awayTeam:"TBL",homeTeam:"BUF",asOf:at,observations,identities,starterEvidence});
assert.equal(result.writes,0);
assert.equal(result.sides[0].goalieName,"Goalie A");
assert.equal(result.sides[0].verifiedEvidence,false);
assert.equal(result.sides[1].verifiedEvidence,true);
assert.equal(result.verifiedBoth,false);
const future=diagnoseGoalies({gameId:1,awayTeam:"TBL",homeTeam:"BUF",asOf:"2026-11-11T19:30:00Z",observations,identities,starterEvidence});
assert.equal(future.sides[0].reason,"missing_pregame_observation");
assert.equal(future.sides[1].verifiedEvidence,false);
console.log("CORE 4.3 goalie readiness diagnostics passed");
