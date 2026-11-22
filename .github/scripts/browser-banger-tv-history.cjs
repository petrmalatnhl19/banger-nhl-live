"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.setContent('<div id="banger-prediction-hub"></div>');
  await page.evaluate(()=>{
   window.fetch=async input=>{
    const u=new URL(String(input));
    const kind=u.searchParams.get("kind");
    let payload;
    if(kind==="clubhistory"){
     payload={games:Array.from({length:5},(_,i)=>({id:2026020300+i,gameDate:"2026-11-"+String(15+i).padStart(2,"0"),gameState:"OFF"}))};
    }else if(kind==="boxscore"){
     const players=[{sog:3,hits:2,blockedShots:1,pim:4}];
     payload={awayTeam:{abbrev:"CAR"},homeTeam:{abbrev:"NYR"},playerByGameStats:{
      awayTeam:{forwards:players,defense:[],goalies:[{starter:true,saveShotsAgainst:"28/30"}]},
      homeTeam:{forwards:players,defense:[],goalies:[{starter:true,saveShotsAgainst:"28/30"}]}
     }};
    }else if(u.pathname.includes("nhl_prediction_archive")){
     payload=[{game_id:2026020399,game_date:"2026-11-22",away_team:"CAR",home_team:"NYR",status:"pending",core42_away:3,core42_home:2}];
    }else if(u.pathname.includes("core43_shadow_"))payload=[];
    else throw Error("Unexpected fetch "+u.pathname);
    return {ok:true,json:async()=>payload};
   };
  });
  await page.addScriptTag({path:"scripts/banger_tv_match_stats.js"});
  await page.waitForFunction(()=>document.querySelector("#banger-tv-table")?.innerText.includes("Vzorek týmových boxscore: 5 / 5"),null,{timeout:10000}).catch(async error=>{const state=await page.evaluate(()=>({status:document.querySelector("#banger-tv-status")?.textContent,board:document.querySelector("#banger-tv-board")?.innerText,ready:document.readyState}));throw Error("BANGER TV render diagnostic: "+JSON.stringify(state)+"; "+error.message);});
  const text=await page.locator("#banger-tv-table").innerText();
  for(const label of ["Střely na branku","Hity","Blokované střely","Trestné minuty","Vzorek týmových boxscore: 5 / 5"])assert.ok(text.includes(label),label);
  assert.ok(!text.includes("Historie alespoň jednoho týmu"));
  assert.deepEqual(errors,[]);
  console.log("BANGER TV browser render PASS: CAR/NYR 5 / 5 boxscores and historical rows");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
