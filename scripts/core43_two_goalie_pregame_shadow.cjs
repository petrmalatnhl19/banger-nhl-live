"use strict";
/* Experimental two-goalie pregame sensitivity. No forecast publishing or database writes. */
const {preparePregameGoalieGsax}=require("./core43_pregame_goalie_gsax_bridge.cjs");
const {calculateShadow}=require("./core43_gsax_sensitivity.cjs");
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
function calculatePregameTwoGoalieShadow({gameId,awayTeam,homeTeam,predictionAt,kickoffAt,baseline,observations=[],identities=[],gsaxRows=[],gsaxFetchedAt,coefficient}={}){
 const fail=reason=>({available:false,reason,production:false,persistable:false,experimental:true});
 if(!gameId||!/^[A-Z]{3}$/.test(awayTeam||"")||!/^[A-Z]{3}$/.test(homeTeam||"")||awayTeam===homeTeam||!valid(predictionAt)||!valid(kickoffAt)||Date.parse(predictionAt)>=Date.parse(kickoffAt))return fail("invalid_game_context");
 if(!baseline||!valid(baseline.predictedAt)||Date.parse(baseline.predictedAt)>Date.parse(predictionAt))return fail("invalid_baseline_time");
 const opts={gameId,predictionAt,kickoffAt,observations,identities,gsaxRows,gsaxFetchedAt};
 const away=preparePregameGoalieGsax({...opts,teamCode:awayTeam});
 if(!away.available)return fail("away_"+away.reason);
 const home=preparePregameGoalieGsax({...opts,teamCode:homeTeam});
 if(!home.available)return fail("home_"+home.reason);
 if(away.goalieId===home.goalieId)return fail("duplicate_goalie_identity");
 const toSensitivity=x=>({available:true,value:{gsaxPer100Shots:x.gsaxPer100Shots,shotsAgainst:x.shotsAgainst,fetchedAt:x.gsaxFetchedAt}});
 const result=calculateShadow({baseline,awayGoalie:toSensitivity(away),homeGoalie:toSensitivity(home),asOf:predictionAt,coefficient});
 if(!result.available)return fail(result.reason);
 return {...result,gameId,awayTeam,homeTeam,goalies:{away:{goalieId:away.goalieId,starterStatus:"projected",observedStatus:away.observedStatus,gsax:away.gsax,shotsAgainst:away.shotsAgainst},home:{goalieId:home.goalieId,starterStatus:"projected",observedStatus:home.observedStatus,gsax:home.gsax,shotsAgainst:home.shotsAgainst}},production:false,persistable:false,calibrated:false,warning:"Uncalibrated projected-goalie sensitivity, not a publishable CORE 4.3 forecast."};
}
module.exports={calculatePregameTwoGoalieShadow};
