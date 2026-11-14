"use strict";
const fs=require("node:fs"),path=require("node:path");
const {setTimeout:sleep}=require("node:timers/promises");
const OUT=process.env.MONITOR_OUTPUT||"artifacts/stab-05-14";
const API=process.env.NHL_API_BASE||"https://api-web.nhle.com/v1";
const N=Math.min(18,Math.max(1,Number(process.env.MONITOR_ITERATIONS||12)));
const INTERVAL=Math.max(0,Number(process.env.MONITOR_INTERVAL_MS??300000));
const TIMEOUT=Math.max(1000,Number(process.env.MONITOR_TIMEOUT_MS||12000));
fs.mkdirSync(OUT,{recursive:true});
const write=(file,obj)=>fs.appendFileSync(path.join(OUT,file),JSON.stringify(obj)+"\n");
const last=new Map(),metrics={samples:0,requests:0,failures:0,changes:0,latencies:[]};
async function get(url,kind,gameId){
 const started=performance.now();metrics.requests++;
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(TIMEOUT),headers:{accept:"application/json"}});
  if(!response.ok)throw Error("HTTP "+response.status);
  const data=await response.json(),latencyMs=Math.round(performance.now()-started);
  metrics.latencies.push(latencyMs);return {data,latencyMs};
 }catch(e){
  metrics.failures++;
  write("errors.jsonl",{at:new Date().toISOString(),kind,gameId:gameId||null,url,error:e.message,latencyMs:Math.round(performance.now()-started)});
  return null;
 }
}
const normalizeGame=g=>({id:g.id,state:g.gameState||null,away:g.awayTeam?.abbrev||null,home:g.homeTeam?.abbrev||null,awayScore:g.awayTeam?.score??null,homeScore:g.homeTeam?.score??null,period:g.periodDescriptor?.number??null});
function normalizeStats(box){
 const out={};
 for(const side of ["awayTeam","homeTeam"]){
  const group=box.playerByGameStats?.[side]||{},team=box[side]||{};
  const skaters=[...(group.forwards||[]),...(group.defense||[])];
  out[side]={shotsOnGoal:team.sog??null,skaters:skaters.map(p=>({id:p.playerId,goals:p.goals??null,assists:p.assists??null,shots:p.sog??null,hits:p.hits??null,blocks:p.blockedShots??null})).sort((a,b)=>a.id-b.id),goalies:(group.goalies||[]).map(p=>({id:p.playerId,saves:p.saves??null,shotsAgainst:p.shotsAgainst??null})).sort((a,b)=>a.id-b.id)};
 }
 return out;
}
function track(game,stats,at){
 const prev=last.get(game.id);
 if(prev){
  for(const key of ["state","awayScore","homeScore","period"]){
   if(prev.game[key]!==game[key]){metrics.changes++;write("events.jsonl",{at,gameId:game.id,kind:"game",field:key,from:prev.game[key],to:game[key]});}
  }
  if(stats&&prev.stats&&JSON.stringify(stats)!==JSON.stringify(prev.stats)){metrics.changes++;write("events.jsonl",{at,gameId:game.id,kind:"statistics",from:prev.stats,to:stats});}
 }
 last.set(game.id,{game,stats:stats||prev?.stats||null});
}
async function sample(){
 const at=new Date().toISOString(),score=await get(API+"/score/now","scoreboard");
 if(!score){write("samples.jsonl",{at,error:"scoreboard_unavailable"});return;}
 const games=[];
 for(const item of (score.data.games||[]).slice(0,16)){
  const game=normalizeGame(item);let stats=null,boxLatencyMs=null;
  if(["LIVE","CRIT","OFF","FINAL"].includes(game.state)){
   const box=await get(API+"/gamecenter/"+game.id+"/boxscore","boxscore",game.id);
   if(box){stats=normalizeStats(box.data);boxLatencyMs=box.latencyMs;}
  }
  track(game,stats,at);games.push({...game,stats,boxLatencyMs});
 }
 metrics.samples++;write("samples.jsonl",{at,scoreboardLatencyMs:score.latencyMs,games});
 console.log(at,"games",games.length,"changes",metrics.changes,"failures",metrics.failures);
}
async function main(){
 for(let i=0;i<N;i++){await sample();if(i<N-1)await sleep(INTERVAL);}
 const sorted=metrics.latencies.sort((a,b)=>a-b);
 const report={at:new Date().toISOString(),samples:metrics.samples,requests:metrics.requests,failures:metrics.failures,changes:metrics.changes,p50LatencyMs:sorted.length?sorted[Math.floor(sorted.length*.5)]:null,p95LatencyMs:sorted.length?sorted[Math.ceil(sorted.length*.95)-1]:null};
 fs.writeFileSync(path.join(OUT,"summary.json"),JSON.stringify(report,null,2));
 console.log("STAB-05.14 summary",JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,"## STAB-05.14 NHL API monitoring\n\n"+JSON.stringify(report,null,2)+"\n\nAPI telemetry only; not browser rendering latency.\n");
 if(!metrics.samples)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
