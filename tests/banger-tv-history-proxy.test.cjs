"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const src=fs.readFileSync("scripts/banger_tv_match_stats.js","utf8");
test("BANGER TV history is browser-safe and keeps CORE untouched",()=>{
 assert.match(src,/kind=clubhistory/);
 assert.match(src,/\(boxscore\|right-rail\)/);
 assert.match(src,/encodeURIComponent\(match\[2\]\)/);
 assert.doesNotMatch(src,/fetch\('https:\/\/api-web\.nhle\.com/);
 assert.match(src,/gameState==='FINAL'/);
 assert.match(src,/Historie alespoň jednoho týmu/);
 new vm.Script(src,{filename:"banger_tv_match_stats.js"});
});

test("CAR and NYR: five completed games each produce real boxscore averages through proxy fixtures",async()=>{
 const requested=[];
 const mockFetch=async url=>{
  const u=new URL(url);requested.push(u);
  if(u.searchParams.get("kind")==="clubhistory"){
   const team=u.searchParams.get("team");
   assert.ok(["CAR","NYR"].includes(team));
   assert.equal(u.searchParams.get("season"),"20262027");
   return {ok:true,json:async()=>({games:[
    {id:2026020999,gameDate:"2026-11-22",gameState:"OFF"},
    ...Array.from({length:5},(_,i)=>({id:2026020300+i,gameDate:"2026-11-"+String(15+i).padStart(2,"0"),gameState:i%2?"FINAL":"OFF"}))
   ]})};
  }
  assert.equal(u.searchParams.get("kind"),"boxscore");
  const id=Number(u.searchParams.get("id"));
  assert.ok(id>=2026020300&&id<=2026020304);
  const players=[{sog:3,hits:2,blockedShots:1,pim:4}];
  return {ok:true,json:async()=>({
   awayTeam:{abbrev:"CAR"},homeTeam:{abbrev:"NYR"},
   playerByGameStats:{
    awayTeam:{forwards:players,defense:[],goalies:[{starter:true,saveShotsAgainst:"28/30"}]},
    homeTeam:{forwards:players,defense:[],goalies:[{starter:true,saveShotsAgainst:"28/30"}]}
   }
  })};
 };
 const context={
  fetch:mockFetch,AbortSignal,Map,Promise,Number,String,RegExp,
  document:{readyState:"loading",addEventListener(){}},
  MutationObserver:class{observe(){}},
 };
 // Export the closure-private history function only in this test VM.
 const instrumented=src.replace(/\}\)\(\);\s*$/, "globalThis.__history=history;})();");
 assert.notEqual(instrumented,src);
 vm.runInNewContext(instrumented,context);
 for(const team of ["CAR","NYR"]){
  const result=await context.__history(team,"2026-11-22");
  assert.equal(result.n,5);
  assert.equal(result.shots,3);
  assert.equal(result.hits,2);
  assert.equal(result.blocks,1);
  assert.equal(result.pim,4);
  assert.equal(result.goalieN,5);
  assert.ok(result.savePct>93&&result.savePct<94);
  assert.equal(result.specialN,0);
 }
 assert.equal(requested.filter(u=>u.searchParams.get("kind")==="clubhistory").length,2);
 assert.equal(requested.filter(u=>u.searchParams.get("kind")==="boxscore").length,10);
});

test("special-teams proxy is allowlisted and calculates PP/PK from right-rail",async()=>{
 const proxy=fs.readFileSync("supabase/functions/nhl-feed/index.ts","utf8");
 assert.match(proxy,/kind==="right-rail"/);
 assert.match(proxy,/\/right-rail"/);
 assert.match(src,/encodeURIComponent\(match\[2\]\)/);
 assert.match(src,/nhl\('gamecenter\/'\+g.id\+'\/right-rail'\)/);
 const ctx={document:{readyState:"loading",addEventListener(){}},MutationObserver:class{observe(){}},Map,Promise,Number,String,RegExp};
 const instrumented=src.replace(/\}\)\(\);\s*$/, "globalThis.__specialStats=specialStats;})();");
 vm.runInNewContext(instrumented,ctx);
 const stats=ctx.__specialStats({awayTeam:{abbrev:"CAR"},homeTeam:{abbrev:"NYR"},teamGameStats:[{category:"powerPlay",awayValue:"2/5",homeValue:"1/4"}]},"CAR");
 assert.equal(stats.ppGoals,2);
 assert.equal(stats.ppChances,5);
 assert.equal(stats.pkAllowed,1);
 assert.equal(stats.pkFaced,4);
});
