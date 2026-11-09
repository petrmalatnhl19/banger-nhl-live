const assert=require("node:assert/strict");
const {validateEvidence,validateFrozenEvidence}=require("../core43-starter-gate.js");
const {normalize}=require("../core43-starter-reports.js");
const game={gameId:2026020267,awayTeam:"NYR",homeTeam:"SEA",kickoffUTC:"2026-11-07T22:00:00Z"};
const report={gameId:game.gameId,teamCode:"NYR",goalieId:"12345",status:"confirmed",confirmationBasis:"explicit_pregame_report",sourceName:"Verified team report",sourceUrl:"https://example.org/report",sourcePublishedAt:"2026-11-07T20:00:00Z"};
const observed="2026-11-07T20:10:00Z";
assert.equal(normalize(report,game,observed).accepted,true);
assert.equal(normalize({...report,goalieId:"abc"},game,observed).reason,"missing_nhl_goalie_id");
assert.equal(normalize({...report,sourceUrl:"http://example.org"},game,observed).reason,"missing_source_url");
const evidence={...report,verifiedAt:observed};
assert.equal(validateEvidence(evidence,game).accepted,true);
assert.equal(validateEvidence({...evidence,goalieId:"abc"},game).reason,"invalid_goalie_id");
assert.equal(validateEvidence({...evidence,status:"projected"},game).reason,"not_confirmed");
assert.equal(validateEvidence({...evidence,sourceUrl:"http://example.org"},game).reason,"missing_source_url");
// Frozen prediction: confirmation must already exist at prediction time.
const frozenGame={...game,predictionAt:"2026-11-07T20:15:00Z"};
assert.equal(validateEvidence(evidence,frozenGame).accepted,true);
assert.equal(validateEvidence(evidence,{...game,predictionAt:"2026-11-07T20:05:00Z"}).reason,"evidence_after_prediction");
assert.equal(validateEvidence({...evidence,sourcePublishedAt:"2026-11-07T20:12:00Z",verifiedAt:"2026-11-07T20:13:00Z"},frozenGame).accepted,true);
assert.equal(validateEvidence({...evidence,sourcePublishedAt:"2026-11-07T20:16:00Z",verifiedAt:"2026-11-07T20:17:00Z"},frozenGame).reason,"evidence_after_prediction");
assert.equal(validateEvidence(evidence,{...game,predictionAt:"not-a-date"}).reason,"invalid_prediction_time");
assert.equal(validateEvidence(evidence,{...game,predictionAt:"2026-11-07T22:01:00Z"}).reason,"invalid_prediction_time");
assert.equal(validateEvidence({...evidence,verifiedAt:"2026-11-07T19:00:00Z"},frozenGame).reason,"verification_before_publication");
assert.equal(validateEvidence({...evidence,verifiedAt:"2026-11-07T22:01:00Z"},frozenGame).reason,"not_pregame");
assert.equal(validateFrozenEvidence(evidence,game,undefined).reason,"missing_prediction_time");
assert.equal(validateFrozenEvidence(evidence,game,"not-a-date").reason,"missing_prediction_time");
assert.equal(validateFrozenEvidence(evidence,game,"2026-11-07T20:05:00Z").reason,"evidence_after_prediction");
assert.equal(validateFrozenEvidence(evidence,game,"2026-11-07T20:15:00Z").accepted,true);
// Boundary: evidence verified exactly when the prediction is made is available.
assert.equal(validateFrozenEvidence(evidence,game,observed).accepted,true);
assert.equal(validateFrozenEvidence({...evidence,sourcePublishedAt:observed},game,observed).accepted,true);
// Invalid or missing kickoff must not allow archived evidence through.
assert.equal(validateFrozenEvidence(evidence,{...game,kickoffUTC:"invalid"},"2026-11-07T20:15:00Z").accepted,false);
assert.equal(validateFrozenEvidence(evidence,{...game,kickoffUTC:undefined},"2026-11-07T20:15:00Z").accepted,false);
console.log("CORE 4.3 goalie validation tests passed");
