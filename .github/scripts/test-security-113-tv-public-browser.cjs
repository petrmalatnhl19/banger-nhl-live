"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {FIELDS,DEFAULT_MODE,readPublic}=require("../../security/local/security113-tv-public-browser.js");
const base="https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/tv_public_predictions_v1";
(async()=>{
 assert.equal(DEFAULT_MODE,"legacy");
 assert.equal(FIELDS.length,9);
 let calls=0;
 const fetchImpl=async(url,opts)=>{calls++;const parsed=new URL(url);assert.equal(parsed.searchParams.get("select"),FIELDS.join(","));assert.equal(parsed.searchParams.get("limit"),"40");assert.equal(opts.method,"GET");assert(!opts.headers.Authorization);return {ok:true,json:async()=>[{game_id:101,core42_away:0,core43_away:null,internal_secret:"SECRET"}]};};
 const config={endpoint:base,apikey:"sb_publishable_test",fetchImpl};
 await assert.rejects(readPublic(config),/disabled/);
 assert.equal(calls,0);
 const rows=await readPublic({...config,mode:"public"});
 assert.equal(calls,1);
 assert.equal(rows[0].core42_away,0);
 assert.equal(rows[0].core43_away,null);
 assert(!JSON.stringify(rows).includes("SECRET"));
 for(const endpoint of ["http://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/tv_public_predictions_v1",
 "https://evil.example/rest/v1/tv_public_predictions_v1",
 "https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/core43_shadow_predictions_v1",
 "https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/tv_public_predictions_v1?select=*"]){
   await assert.rejects(readPublic({...config,mode:"public",endpoint}),/endpoint|host|path/);
 }
 assert.equal(calls,1);
 await assert.rejects(readPublic({...config,mode:"public",fetchImpl:async()=>({ok:false,status:403})}),/unavailable/);
 await assert.rejects(readPublic({...config,mode:"public",fetchImpl:async()=>({ok:true,json:async()=>[{game_id:101,core43_away:Infinity}]})}),/invalid/);
 await assert.rejects(readPublic({...config,mode:"public",fetchImpl:async()=>({ok:true,json:async()=>[{game_id:101},{game_id:101}]})}),/duplicate/);
 const html=fs.readFileSync(path.join(__dirname,"../../index.html"),"utf8");
 assert(!html.includes("security113-tv-public-browser.js"),"reader must not be deployed yet");
 console.log("PASS SECURITY-113 default-off browser public API reader (offline)");
})().catch(e=>{console.error(e);process.exitCode=1});
