"use strict";
const assert=require("node:assert/strict");
const {verifyArchive}=require("./core43_verify_archive_deployment.cjs");
(async()=>{
 const calls=[];
 const fetchImpl=async(url,opts)=>{calls.push(opts.method);return {ok:true,json:async()=>[]};};
 const report=await verifyArchive({url:"https://example.supabase.co",key:"test-server-key",fetchImpl});
 assert.equal(report.archived,0);assert.equal(report.valid,true);assert.deepEqual(calls,["GET"]);
 await assert.rejects(()=>verifyArchive({url:"https://example.supabase.co",key:"",fetchImpl}),/missing_server/);
 console.log("CORE 4.3 archive deployment verification tests passed");
})().catch(e=>{console.error(e);process.exitCode=1});
