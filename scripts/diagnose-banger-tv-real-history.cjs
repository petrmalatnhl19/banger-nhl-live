"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const src=fs.readFileSync("scripts/banger_tv_match_stats.js","utf8");
const key=src.match(/apikey:'([^']+)'/)?.[1];
assert.ok(key,"Missing public publishable key");
const origin="https://xxwqeiuyislnoxsmjuul.supabase.co/functions/v1/nhl-feed";
const headers={apikey:key};
const date="2026-11-22";
async function get(params){
 const url=origin+"?"+new URLSearchParams(params);
 const response=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(params.kind+" HTTP "+response.status);
 return response.json();
}
async function check(team){
 const schedule=await get({kind:"clubhistory",team,season:"20262027"});
 assert.ok(Array.isArray(schedule.games),team+": invalid schedule.games");
 const games=schedule.games.filter(g=>g.gameDate<date&&["OFF","FINAL"].includes(g.gameState))
  .sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,5);
 assert.equal(games.length,5,team+": insufficient completed games");
 let valid=0;
 for(const game of games){
  const box=await get({kind:"boxscore",id:String(game.id)});
  const side=box.awayTeam?.abbrev===team?"awayTeam":box.homeTeam?.abbrev===team?"homeTeam":null;
  assert.ok(side,team+": boxscore missing team for "+game.id);
  const group=box.playerByGameStats?.[side];
  const players=[...(group?.forwards||[]),...(group?.defense||[])];
  assert.ok(players.length,team+": no player boxscore "+game.id);
  const sums=["sog","hits","blockedShots","pim"].map(k=>players.reduce((sum,p)=>sum+(Number(p[k])||0),0));
  assert.ok(sums.every(Number.isFinite),team+": invalid player totals "+game.id);
  valid++;
 }
 console.log(team+": verified "+valid+"/5 real NHL boxscores via deployed proxy");
}
(async()=>{for(const team of ["CAR","NYR"])await check(team);console.log("REAL DATA PASS: 10/10 boxscores");})().catch(e=>{console.error("REAL DATA FAIL:",e.message);process.exitCode=1;});
