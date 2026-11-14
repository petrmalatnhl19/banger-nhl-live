"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const start=html.indexOf("const bangerNhlFeedInflight=new Map();");
const end=html.indexOf("function state(v)",start);
assert(start>=0&&end>start,"NHL feed wrapper must exist");
const wrapper=html.slice(start,end);
assert(wrapper.includes("AbortSignal.timeout(12000)"),"NHL feed must enforce a 12-second timeout");
const score="https://api-web.nhle.com/v1/score/2026-11-14";
function harness(fetchImpl,timeoutMs=20){
 let timeoutCalls=0;
 const sandbox={Map,Date,encodeURIComponent,fetch:fetchImpl,AbortSignal:{timeout(ms){assert.equal(ms,12000);timeoutCalls++;return AbortSignal.timeout(timeoutMs)}}};
 vm.createContext(sandbox);
 vm.runInContext(wrapper+"\nthis.testGet=get;",sandbox);
 return {get:sandbox.testGet,timeoutCalls:()=>timeoutCalls};
}
(async()=>{
 let calls=0;
 const ok=harness(async()=>{calls++;return {ok:true,json:async()=>({games:[1]})}});
 const [a,b]=await Promise.all([ok.get(score),ok.get(score)]);
 assert.equal(calls,1,"identical concurrent requests must be deduplicated");
 assert.equal(a.games[0],1);assert.equal(b.games[0],1);
 await ok.get(score);
 assert.equal(calls,2,"completed requests must not remain inflight");
 assert.equal(ok.timeoutCalls(),2);
 let failures=0;
 const slow=harness((_url,{signal})=>{failures++;return new Promise((_resolve,reject)=>{
  signal.addEventListener("abort",()=>reject(Object.assign(new Error("aborted"),{name:"TimeoutError"})),{once:true});
 })});
 await assert.rejects(slow.get(score),/NHL feed timeout \(12 s\)/);
 await assert.rejects(slow.get(score),/NHL feed timeout \(12 s\)/);
 assert.equal(failures,2,"timed-out request must be removed from inflight map");
 let recovered=0;
 const retry=harness(async()=>{recovered++;if(recovered===1)throw Error("temporary");return {ok:true,json:async()=>({games:[2]})}});
 await assert.rejects(retry.get(score),/temporary/);
 assert.equal((await retry.get(score)).games[0],2);
 console.log("STAB-01 NHL feed timeout regression tests passed");
})().catch(e=>{console.error(e);process.exitCode=1});
