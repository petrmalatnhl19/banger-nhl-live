'use strict';
// LINEUPS-03.23: display-ready, explicitly unverified candidate special teams.
// Interpret strength relative to away/home, never confuse 5v6 with PP.
function summarizeSpecialTeamsCandidates(named,awayId,homeId){
 const fail={status:'unverified',teams:[],verifiedUnits:false,publishable:false};
 if(named?.status!=='candidate-only'||!Array.isArray(named.teams)||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return fail;
 const result=[];
 for(const id of [awayId,homeId]){
  const team=named.teams.find(t=>t.teamId===id);
  if(!team||!Array.isArray(team.units))return fail;
  const groups={PP:[],PK:[]};
  for(const unit of team.units){
   if(!/^\d+v\d+$/.test(unit.strength)||!Array.isArray(unit.players)||!Number.isInteger(unit.seconds)||unit.seconds<=0)return fail;
   const [away,home]=unit.strength.split('v').map(Number),own=id===awayId?away:home,opp=id===awayId?home:away;
   if(!Number.isInteger(own)||!Number.isInteger(opp)||own<3||opp<3||own>6||opp>6)return fail;
   if(own===opp||own===6||opp===6)continue;
   const type=own>opp?'PP':'PK';
   if(unit.players.length!==own||unit.players.some(p=>!Number.isInteger(p.playerId)||!p.name||typeof p.name!=='string'))return fail;
   groups[type].push({strength:unit.strength,seconds:unit.seconds,players:unit.players.map(p=>({playerId:p.playerId,name:p.name,position:p.position||null})),status:'candidate-only'});
  }
  for(const type of ['PP','PK'])groups[type].sort((a,b)=>b.seconds-a.seconds||a.players.map(p=>p.playerId).join(',').localeCompare(b.players.map(p=>p.playerId).join(',')));
  result.push({teamId:id,PP:groups.PP,PK:groups.PK});
 }
 return {status:'candidate-only',teams:result,verifiedUnits:false,publishable:false,reason:'Strength-specific candidate lineups are NOT confirmed special-teams units.'};
}
module.exports={summarizeSpecialTeamsCandidates};
