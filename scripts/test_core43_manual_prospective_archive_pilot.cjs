"use strict";
const assert=require("node:assert/strict");
const {pilot}=require("./core43_manual_prospective_archive_pilot.cjs");
(async()=>{
 await assert.rejects(()=>pilot({gameId:"bad",key:"x"}),/invalid_game_id/);
 await assert.rejects(()=>pilot({gameId:"123"}),/missing_server_credentials/);
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push({url,method:opts.method||"GET"});return {ok:true,status:200,json:async()=>[]};};
 const r=await pilot({url:"https://example.supabase.co",key:"server-only",gameId:"123",enabled:true,now:()=>"2026-11-11T12:00:00Z",fetchImpl});
 assert.equal(r.inserted,false);assert.equal(r.reason,"no_upcoming_baseline_ready_game");
 assert.equal(calls.every(c=>c.method==="GET"),true);
 console.log("CORE 4.3 manual pilot safeguards passed");
})().catch(e=>{console.error(e);process.exitCode=1});
