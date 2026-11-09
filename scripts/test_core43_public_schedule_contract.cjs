"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
for(const path of ["core-performance.js","scripts/core43_verified_dashboard.js"]){
 const src=fs.readFileSync(path,"utf8");
 assert.match(src,/nhl_core43_public_schedule_evidence\?select=/);
 assert.doesNotMatch(src,/nhl_core43_schedule_snapshots\?select=/);
}
const sql=fs.readFileSync("scripts/sql/core43_public_schedule_evidence.sql","utf8");
assert.match(sql,/SELECT DISTINCT game_id, kickoff_at, away_team, home_team/);
assert.match(sql,/GRANT SELECT ON public\.nhl_core43_public_schedule_evidence TO anon, authenticated/);
assert.doesNotMatch(sql,/GRANT SELECT ON public\.nhl_core43_schedule_snapshots/);
console.log("Public schedule evidence access contract passed");
