'use strict';
// LINEUPS-03.22: names for strength-specific candidate units; never confirmed.
function annotateStrengthUnits(summary,boxscore){
 const fail={status:'unverified',teams:[],verifiedUnits:false};
 if(summary?.status!=='candidate-only'||!Array.isArray(summary.teams)||!boxscore?.playerByGameStats)return fail;
 const maps=new Map();
 for(const side of ['awayTeam','homeTeam']){
  const id=boxscore[side]?.id,group=boxscore.playerByGameStats[side];
  if(!Number.isInteger(id)||!group)return fail;
  const map=new Map();
  for(const p of [...(group.forwards||[]),...(group.defense||[])]){
   if(!Number.isInteger(p.playerId)||map.has(p.playerId))return fail;
   const name=(p.name?.default||[p.firstName?.default,p.lastName?.default].filter(Boolean).join(' ')).trim();
   if(!name)return fail;
   map.set(p.playerId,{name,position:p.position||null});
  }
  maps.set(id,map);
 }
 const teams=[];
 for(const team of summary.teams){
  const map=maps.get(team.teamId);
  if(!map||!Array.isArray(team.units))return fail;
  const units=[];
  for(const unit of team.units){
   if(!Array.isArray(unit.playerIds)||!/^\d+v\d+$/.test(unit.strength)||!Number.isInteger(unit.seconds)||unit.seconds<=0)return fail;
   const players=unit.playerIds.map(playerId=>({playerId,...(map.get(playerId)||{name:null,position:null})}));
   if(players.some(p=>!p.name))return fail;
   units.push({strength:unit.strength,seconds:unit.seconds,players});
  }
  teams.push({teamId:team.teamId,seconds:team.seconds,unitCount:units.length,units});
 }
 return {status:'candidate-only',teams,verifiedUnits:false,reason:'Roster-matched identities only. Strength windows and special-teams deployment are not independently verified.'};
}
module.exports={annotateStrengthUnits};
