const assert=require("node:assert/strict");
const m=require("../core43-inputs.js");
const kickoff="2026-11-08T20:00:00Z";
const past=[{state:"OFF",startTimeUTC:"2026-11-07T19:00:00Z",endTimeUTC:"2026-11-07T21:30:00Z"}];
const f=m.fatigue(past,kickoff);assert.equal(f.available,true);assert.equal(f.value.backToBack,true);
assert.equal(m.fatigue([{...past[0],endTimeUTC:"2026-11-09T00:00:00Z"}],kickoff).available,false);
assert.equal(m.gsax({expectedGoalsAgainst:10,goalsAgainst:7,shotsAgainst:100}).value.gsax,3);
assert.equal(m.gsax({expectedGoalsAgainst:10,goalsAgainst:7,shotsAgainst:10}).available,false);
const a=m.absences([{id:1},{id:2}],[{id:1,status:"out",verifiedAt:"2026-11-08T10:00:00Z"},{id:2,status:"out",verifiedAt:"2026-11-09T10:00:00Z"},{id:3,status:"out",verifiedAt:"2026-11-08T10:00:00Z"}],kickoff);
assert.deepEqual(a.value.verifiedPlayerIds,["1"]);
assert.equal(m.core43Inputs({kickoff}).production,false);
const nhlGames=[
 {gameState:"OFF",startTimeUTC:"2026-11-07T20:00:00Z",homeTeam:{abbrev:"DAL",score:3},awayTeam:{abbrev:"COL",score:2}},
 {gameState:"FUT",startTimeUTC:"2026-11-09T20:00:00Z",homeTeam:{abbrev:"DAL"},awayTeam:{abbrev:"BOS"}}
];
const n=m.nhlScheduleFatigue(nhlGames,"2026-11-08T20:00:00Z","DAL");
assert.equal(n.available,true);
assert.equal(n.value.hoursBetweenStarts,24);
assert.equal(n.value.consecutiveCalendarDays,true);
assert.equal(n.value.exactRestHours,null);
assert.equal(m.nhlScheduleFatigue(nhlGames,"2026-11-08T20:00:00Z","NYR").available,false);
assert.equal(m.core43Inputs({kickoff:"2026-11-08T20:00:00Z",nhlGames,team:"DAL"}).fatigue.available,true);
console.log("CORE 4.3 experimental input tests passed");
