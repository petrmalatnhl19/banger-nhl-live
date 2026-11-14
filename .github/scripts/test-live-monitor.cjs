"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path"),http=require("node:http");
const {spawnSync}=require("node:child_process");
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"banger-live-"));
let calls=0;
const server=http.createServer((req,res)=>{
 res.setHeader("Content-Type","application/json");
 if(req.url==="/score/now"){
  calls++;
  return res.end(JSON.stringify({games:[{id:999,state:"",gameState:calls===1?"LIVE":"FINAL",awayTeam:{abbrev:"DAL",score:calls===1?1:3},homeTeam:{abbrev:"BOS",score:0},periodDescriptor:{number:3}}]}));
 }
 if(req.url==="/gamecenter/999/boxscore")return res.end(JSON.stringify({awayTeam:{sog:calls===1?12:24},homeTeam:{sog:10},playerByGameStats:{awayTeam:{forwards:[{playerId:5,goals:calls===1?1:3,assists:0,sog:4}],defense:[],goalies:[]},homeTeam:{forwards:[],defense:[],goalies:[]}}}));
 res.statusCode=404;res.end("{}");
});
server.listen(0,"127.0.0.1",()=>{
 const port=server.address().port;
 const child=require("node:child_process").spawn(process.execPath,[".github/scripts/live-monitor.cjs"],{
  env:{...process.env,NHL_API_BASE:"http://127.0.0.1:"+port,MONITOR_OUTPUT:dir,MONITOR_ITERATIONS:"2",MONITOR_INTERVAL_MS:"1"},
  stdio:"inherit"
 });
 child.on("exit",code=>{
  try{
   assert.equal(code,0);
   const events=fs.readFileSync(path.join(dir,"events.jsonl"),"utf8").trim().split("\n").map(JSON.parse);
   assert(events.some(e=>e.field==="state"&&e.to==="FINAL"));
   assert(events.some(e=>e.field==="awayScore"&&e.to===3));
   assert(events.some(e=>e.kind==="statistics"));
   const summary=JSON.parse(fs.readFileSync(path.join(dir,"summary.json"),"utf8"));
   assert.equal(summary.samples,2);assert.equal(summary.failures,0);assert(summary.requests>=4);
   console.log("STAB-05.14 deterministic LIVE->FINAL, statistics and latency checks passed");
  }catch(e){console.error(e);process.exitCode=1;}finally{server.close();fs.rmSync(dir,{recursive:true,force:true});}
 });
});
