const assert=require("node:assert/strict");
const {aggregateGoalie}=require("../core43-gsax.js");
const rows=[
 {goalieId:10,gameDate:"2026-11-01T20:00:00Z",sourceUpdatedAt:"2026-11-02T03:00:00Z",situation:"all",xGoalsAgainst:3.5,goalsAgainst:2,shotsAgainst:35},
 {goalieId:10,gameDate:"2026-11-04T20:00:00Z",sourceUpdatedAt:"2026-11-05T03:00:00Z",situation:"all",xGoalsAgainst:2.5,goalsAgainst:3,shotsAgainst:30},
 {goalieId:10,gameDate:"2026-11-08T20:00:00Z",sourceUpdatedAt:"2026-11-09T03:00:00Z",situation:"all",xGoalsAgainst:50,goalsAgainst:0,shotsAgainst:50}
];
const options={goalieId:10,kickoff:"2026-11-07T20:00:00Z"};
const result=aggregateGoalie(rows,options);
assert.equal(result.available,true);
assert.equal(result.value.gsax,1);
assert.equal(result.value.shotsAgainst,65);
assert.equal(result.value.sampleGames,2);
assert.equal(aggregateGoalie(rows,{...options,minShots:70}).available,false);
assert.equal(aggregateGoalie(rows,{...options,goalieId:999}).available,false);
assert.equal(aggregateGoalie([{...rows[0],sourceUpdatedAt:"2026-11-09T00:00:00Z"}],options).available,false);
assert.equal(aggregateGoalie([{...rows[0],xGoalsAgainst:-1}],options).available,false);
console.log("CORE 4.3 GSAx tests passed");
