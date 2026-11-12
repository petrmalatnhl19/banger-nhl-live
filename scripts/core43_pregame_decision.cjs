"use strict";
/* Pure, read-only decision layer. This is NOT a prediction archive writer. */
function classifyPregameDecision(game, now){
 if(!game||typeof now!=="string"||!Number.isFinite(Date.parse(now))||typeof game.kickoffAt!=="string"||!Number.isFinite(Date.parse(game.kickoffAt)))throw Error("invalid_pregame_decision");
 const minutesToKickoff=(Date.parse(game.kickoffAt)-Date.parse(now))/60000;
 const summary=game.readinessSummary||{};
 const missing=Array.isArray(summary.missing)?summary.missing:[];
 if(minutesToKickoff<=0)return {status:"expired",reason:"kickoff_reached",minutesToKickoff,archiveAllowed:false};
 if(!game.baselineReady)return {status:"blocked",reason:"core42_baseline",minutesToKickoff,archiveAllowed:false};
 if(missing.length)return {status:"blocked",reason:missing[0],missing,minutesToKickoff,archiveAllowed:false};
 if(game.ready!==true||summary.experimentalReady!==true)return {status:"blocked",reason:"experimental_capture_not_ready",minutesToKickoff,archiveAllowed:false};
 if(minutesToKickoff>60)return {status:"watch",reason:"outside_final_hour",minutesToKickoff,archiveAllowed:false};
 return {status:"experimental_ready",reason:null,minutesToKickoff,verifiedStarters:summary.verifiedStarters===true,archiveAllowed:false};
}
function classifyMonitor(report){
 if(!report||!Array.isArray(report.results)||typeof report.generatedAt!=="string")throw Error("invalid_monitor_report");
 const games=report.results.map(game=>({...game,decision:classifyPregameDecision(game,report.generatedAt)}));
 return {...report,decisionCounts:{experimental_ready:games.filter(g=>g.decision.status==="experimental_ready").length,watch:games.filter(g=>g.decision.status==="watch").length,blocked:games.filter(g=>g.decision.status==="blocked").length,expired:games.filter(g=>g.decision.status==="expired").length},results:games,archived:0};
}
module.exports={classifyPregameDecision,classifyMonitor};
