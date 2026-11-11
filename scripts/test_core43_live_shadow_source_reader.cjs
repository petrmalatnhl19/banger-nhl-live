"use strict";
const assert=require("node:assert/strict");
const {TABLES,loadLiveShadowSources,inspectLiveShadowGame}=require("./core43_live_shadow_source_reader.cjs");
const calls=[];
const fetchImpl=async(url,opts)=>{calls.push({url,method:opts.method});return {ok:true,json:async()=>[]};};
(async()=>{
 const data=await loadLiveShadowSources({url:"https://example.supabase.co",key:"server-only-test",gameId:123,fetchImpl});
 assert.deepEqual(Object.keys(data),Object.keys(TABLES));
 assert.equal(calls.length,5);
 assert(calls.every(c=>c.method==="GET"));
 assert(calls.filter(c=>c.url.includes("game_id=eq.123")).length===3);
 assert(calls.find(c=>c.url.includes("nhl_core43_goalie_snapshots")).url.includes("game_id=")===false);
 const result=await inspectLiveShadowGame({url:"https://example.supabase.co",key:"server-only-test",gameId:123,awayTeam:"DAL",homeTeam:"NYR",asOf:"2026-11-11T12:00:00Z",now:"2026-11-11T12:01:00Z",fetchImpl});
 assert.equal(result.captured,false);
 assert.equal(result.reason,"no_verified_archived_gsax_snapshot");
 await assert.rejects(()=>loadLiveShadowSources({url:"https://example.supabase.co",key:"",gameId:123,fetchImpl}),/missing_server/);
 console.log("CORE 4.3 read-only source reader tests passed");
})().catch(e=>{console.error(e);process.exitCode=1});
