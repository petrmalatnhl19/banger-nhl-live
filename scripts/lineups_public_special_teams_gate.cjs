'use strict';
// LINEUPS-03.25: fail-closed fan-facing publishing gate.
// Candidate-only analytics are internal. Never infer verified PP/PK from
// dominance of a combination, names, event counts, or shiftchart coverage.
function publicSpecialTeamsView(candidateSummary,coverage){
 const hidden={status:'unavailable',reason:'Special-teams units are not independently verified',PP:[],PK:[],verifiedUnits:false};
 if(!candidateSummary||!coverage||candidateSummary.status!=='candidate-only'||coverage.status!=='candidate-only')return hidden;
 if(candidateSummary.publishable!==false||candidateSummary.verifiedUnits!==false||coverage.publishable!==false||coverage.verifiedUnits!==false)return hidden;
 // Explicitly avoid returning candidate player names to a public UI.
 return hidden;
}
module.exports={publicSpecialTeamsView};
