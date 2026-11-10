const assert=require("node:assert/strict");
const {calculateProjectedShadow:run}=require("./core43_projected_shadow.cjs");
const asOf="2026-11-09T15:00:00Z";
const baseline={away:2.8,home:3.2,predictedAt:"2026-11-09T10:00:00Z"};
const goalie=(goalieId,probability,gsaxPer100Shots)=>({goalieId,probability,gsaxPer100Shots,
 shotsAgainst:200,fetchedAt:"2026-11-09T12:00:00Z",
 projectionPublishedAt:"2026-11-09T13:00:00Z",projectionSource:"example-projection"});
const awayCandidates=[goalie("100",0.75,2),goalie("101",0.25,0)];
const homeCandidates=[goalie("200",1,-1)];
const args={baseline,awayCandidates,homeCandidates,asOf,kickoffUTC:"2026-11-09T20:00:00Z"};
const result=run(args);
assert.equal(result.available,true);
assert.equal(result.expectedAwayGoals,2.82);
assert.equal(result.expectedHomeGoals,3.17);
assert.equal(result.production,false);
assert.equal(result.persistable,false);
assert.equal(result.starterEvidence,"projected_not_confirmed");
assert.equal(run({...args,awayCandidates:[goalie("100",0.5,2)]}).reason,"unnormalized_away_probabilities");
assert.equal(run({...args,awayCandidates:[goalie("100",1,2),goalie("100",0,0)]}).reason,"invalid_away_identity");
assert.equal(run({...args,homeCandidates:[goalie("100",1,-1)]}).reason,"duplicate_goalie_across_teams");
assert.equal(run({...args,awayCandidates:[{...goalie("100",1,2),projectionPublishedAt:"2026-11-09T16:00:00Z"}]}).reason,"late_away_projection");
assert.equal(run({...args,awayCandidates:[{...goalie("100",1,2),projectionSource:""}]}).reason,"missing_away_projection_source");
assert.equal(run({...args,asOf:"2026-11-09T21:00:00Z"}).reason,"invalid_pregame_time");
console.log("CORE 4.3 projected goalie scenario tests passed");
