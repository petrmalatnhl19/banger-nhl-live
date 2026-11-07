/* CORE 4.3 GSAx adapter — experimental; consumes verified, pregame goalie xG data.
 * No network request or production prediction modification.
 * Expected normalized rows: goalieId, gameDate, xGoalsAgainst, goalsAgainst,
 * shotsAgainst, situation, sourceUpdatedAt.
 */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;if(root)root.BangerCore43GSAx=api;})(typeof globalThis!=="undefined"?globalThis:null,function(){
"use strict";
const num=x=>typeof x==="number"&&Number.isFinite(x)?x:(typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):NaN);
const date=x=>typeof x==="string"?Date.parse(x):NaN;
const bad=(reason)=>({available:false,reason,value:null});
function aggregateGoalie(rows,{goalieId,kickoff,situation="all",minShots=30,maxGames=30}={}){
 const t=date(kickoff);
 if(!Array.isArray(rows)||!Number.isFinite(t)||goalieId==null)return bad("invalid_input");
 const candidates=rows.filter(r=>r&&String(r.goalieId)===String(goalieId)&&String(r.situation).toLowerCase()===situation.toLowerCase())
   .filter(r=>Number.isFinite(date(r.gameDate))&&date(r.gameDate)<t&&Number.isFinite(date(r.sourceUpdatedAt))&&date(r.sourceUpdatedAt)<t)
   .sort((a,b)=>date(b.gameDate)-date(a.gameDate)).slice(0,maxGames);
 if(!candidates.length)return bad("no_verified_pregame_rows");
 let xga=0,ga=0,shots=0;
 for(const r of candidates){
  const x=num(r.xGoalsAgainst),g=num(r.goalsAgainst),s=num(r.shotsAgainst);
  if(!Number.isFinite(x)||!Number.isFinite(g)||!Number.isFinite(s)||x<0||g<0||s<0)return bad("invalid_stats");
  xga+=x;ga+=g;shots+=s;
 }
 if(shots<minShots)return bad("insufficient_shots");
 const gsax=xga-ga;
 return {available:true,reason:null,experimental:true,value:{
   goalieId:String(goalieId),gsax:Math.round(gsax*100)/100,
   gsaxPer100Shots:Math.round(gsax/shots*10000)/100,
   xGoalsAgainst:Math.round(xga*100)/100,goalsAgainst:ga,shotsAgainst:shots,
   sampleGames:candidates.length,situation
 }};
}
return {aggregateGoalie};
});
