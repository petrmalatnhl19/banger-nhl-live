'use strict';
// LINEUPS-03.14: independent play-by-play situation-code coverage audit.
// Event codes are point observations, NOT continuous strength intervals.
function auditSituationEvidence(playByPlay,gameId){
 const empty={status:'unverified',eventCount:0,withSituationCode:0,byCode:{},periods:[],verifiedStrengthWindows:false};
 if(!playByPlay||!Array.isArray(playByPlay.plays)||String(playByPlay.id)!==String(gameId))return {...empty,reason:'missing-or-mismatched-game'};
 const codes={},periods=new Set(),examples=[];
 for(const play of playByPlay.plays){
  const period=play.periodDescriptor?.number;
  if(Number.isInteger(period))periods.add(period);
  const code=play.situationCode;
  if(typeof code!=='string'&&!Number.isInteger(code))continue;
  const value=String(code);
  if(!/^\d{4}$/.test(value))continue;
  codes[value]=(codes[value]||0)+1;
  if(examples.length<12)examples.push({period:period??null,timeInPeriod:play.timeInPeriod??null,situationCode:value,typeDescKey:play.typeDescKey??null});
 }
 const withSituationCode=Object.values(codes).reduce((a,b)=>a+b,0);
 return {status:withSituationCode?'event-evidence-only':'unverified',eventCount:playByPlay.plays.length,withSituationCode,byCode:codes,periods:[...periods].sort((a,b)=>a-b),examples,verifiedStrengthWindows:false,reason:'Sparse event situation codes cannot establish complete time intervals or confirmed PP/PK units.'};
}
module.exports={auditSituationEvidence};
