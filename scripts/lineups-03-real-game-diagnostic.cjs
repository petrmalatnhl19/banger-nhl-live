'use strict';
// LINEUPS-03 real-game read-only diagnostic. No production writes or secrets.
// Usage: node scripts/lineups-03-real-game-diagnostic.cjs [gameId]
const https=require('node:https');
const {parseShiftCharts}=require('./lineups_shiftcharts_adapter.cjs');
const {classifyShiftRows}=require('./lineups_shiftcharts_rejection_audit.cjs');
const gameId=process.argv[2]||'2026020335';
if(!/^\d{10}$/.test(gameId)){console.error('Invalid game ID');process.exitCode=2;}
else {
 const url='https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp='+encodeURIComponent('gameId='+gameId);
 const fetchJson=url=>new Promise((resolve,reject)=>{
   const req=https.get(url,{headers:{Accept:'application/json','User-Agent':'BangerNHL-Lineups03-readonly/1.0'},timeout:12000},res=>{
     if(res.statusCode!==200){res.resume();reject(Error('HTTP '+res.statusCode));return}
     let raw='';res.setEncoding('utf8');res.on('data',chunk=>{raw+=chunk;if(raw.length>8_000_000)req.destroy(Error('Oversized response'))});
     res.on('end',()=>{try{resolve(JSON.parse(raw))}catch(e){reject(Error('Invalid JSON'))}});
   });req.on('timeout',()=>req.destroy(Error('Timeout')));req.on('error',reject);
 });
 fetchJson(url).then(payload=>{
   const parsed=parseShiftCharts(payload,gameId);
   const rejectionAudit=classifyShiftRows(payload,gameId);
   const data=Array.isArray(payload.data)?payload.data:[];
   const periods=[...new Set(data.map(x=>x.period))].sort();
   const teams=[...new Set(data.map(x=>x.teamId))].sort();
   const players=new Set(data.map(x=>x.playerId));
   const result={gameId,endpoint:'NHL Stats shiftcharts',http:'200',reportedTotal:payload.total??null,rawRows:data.length,teams,players:players.size,periods,
     accepted:parsed.shifts.length,rejected:parsed.rejected,rejectionReasons:rejectionAudit.reasons,normalizationDetails:rejectionAudit.normalizationDetails,classificationMatchesParser:rejectionAudit.accepted===parsed.shifts.length&&rejectionAudit.rejected===parsed.rejected,status:parsed.status,
     verifiedUnits:false,reason:'No verified strength windows or roster/goalie completeness; this diagnostic does not publish PP/PK units.'};
   console.log(JSON.stringify(result,null,2));
   if(parsed.status!=='partial'||!parsed.shifts.length)process.exitCode=3;
 }).catch(e=>{console.error(JSON.stringify({gameId,status:'fetch-failed',error:e.message,verifiedUnits:false}));process.exitCode=4});
}
