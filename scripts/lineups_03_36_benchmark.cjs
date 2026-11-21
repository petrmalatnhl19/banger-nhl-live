'use strict';
// LINEUPS-03.36: independent benchmark comparison. Never converts candidate data to verified.
const BENCHMARK_2026020335=Object.freeze({
 gameId:2026020335,source:'https://hockeyweights.com/game/2026020335/',
 lines:[
  {team:'EDM',kind:'forward',players:['Hyman','McDavid','Dach'],seconds:663},
  {team:'EDM',kind:'forward',players:['Draisaitl','Kapanen','Podkolzin'],seconds:632},
  {team:'EDM',kind:'defence',players:['Ekholm','Bouchard'],seconds:896},
  {team:'FLA',kind:'forward',players:['Bennett','Tkachuk','Tkachuk'],seconds:617},
  {team:'FLA',kind:'defence',players:['Ekblad','Forsling'],seconds:933}
 ]
});
function compareBenchmark({gameId,sourceRows,rosterCovered,verifiedStrength,observedLines,toleranceSeconds=2}={}){
 const base={status:'unverified',publishable:false,verifiedUnits:false,matched:0,checked:0,discrepancies:[]};
 if(gameId!==BENCHMARK_2026020335.gameId||!Number.isInteger(sourceRows)||sourceRows<=0||rosterCovered!==true||verifiedStrength!==true||!Array.isArray(observedLines)||!Number.isInteger(toleranceSeconds)||toleranceSeconds<0)return {...base,reason:'missing independently verified raw data, roster, strength, or observations'};
 const key=x=>[x.team,x.kind,...x.players.map(s=>String(s).toLowerCase()).sort()].join('|');
 const observed=new Map();
 for(const line of observedLines){
  if(!line||!['EDM','FLA'].includes(line.team)||!['forward','defence'].includes(line.kind)||!Array.isArray(line.players)||!Number.isInteger(line.seconds)||line.seconds<0)return {...base,reason:'invalid observed line'};
  const k=key(line);if(observed.has(k))return {...base,reason:'duplicate observed line'};observed.set(k,line);
 }
 const discrepancies=[];
 for(const expected of BENCHMARK_2026020335.lines){
  const actual=observed.get(key(expected));
  if(!actual||Math.abs(actual.seconds-expected.seconds)>toleranceSeconds)discrepancies.push({team:expected.team,kind:expected.kind,players:expected.players,expectedSeconds:expected.seconds,actualSeconds:actual?.seconds??null});
 }
 return {status:discrepancies.length?'benchmark-mismatch':'benchmark-agreement',publishable:false,verifiedUnits:false,matched:BENCHMARK_2026020335.lines.length-discrepancies.length,checked:BENCHMARK_2026020335.lines.length,discrepancies,reason:'Independent agreement is not proof of PP/PK units or licensing.'};
}
module.exports={BENCHMARK_2026020335,compareBenchmark};
