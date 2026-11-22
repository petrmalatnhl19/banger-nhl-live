'use strict';
// LINEUPS-03.13: display-only game-roster identity mapping. No verified-lineup promotion.
function annotateCandidateUnits(summary,boxscore){
 const roster=boxscore?.playerByGameStats;
 if(!summary||!Array.isArray(summary.teams)||!roster)return {status:'unverified',teams:[],verifiedUnits:false};
 const byTeam=new Map();
 for(const side of ['awayTeam','homeTeam']){
  const teamId=boxscore?.[side]?.id,group=roster[side];
  if(!Number.isInteger(teamId)||!group)return {status:'unverified',teams:[],verifiedUnits:false};
  const players=[...(group.forwards||[]),...(group.defense||[])];
  const names=new Map();
  for(const p of players){
   if(!Number.isInteger(p.playerId)||names.has(p.playerId))return {status:'unverified',teams:[],verifiedUnits:false};
   const first=p.name?.default||p.firstName?.default||'',last=p.lastName?.default||'';
   const full=(first+' '+last).trim();
   names.set(p.playerId,{name:full||null,position:p.position||null});
  }
  byTeam.set(teamId,names);
 }
 const teams=summary.teams.map(team=>{
  const roster=byTeam.get(team.teamId);
  if(!roster||!Array.isArray(team.units))return null;
  return {teamId:team.teamId,seconds:team.seconds,unitCount:team.units.length,
   topFive:team.units.slice(0,5).map(unit=>({seconds:unit.seconds,players:unit.playerIds.map(playerId=>({playerId,...(roster.get(playerId)||{name:null,position:null})}))}))};
 });
 if(teams.some(t=>!t))return {status:'unverified',teams:[],verifiedUnits:false};
 return {status:'candidate-only',teams,verifiedUnits:false};
}
module.exports={annotateCandidateUnits};
