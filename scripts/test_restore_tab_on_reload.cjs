"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const html=fs.readFileSync("index.html","utf8");
const navStart=html.indexOf("const bangerNavigationTabs=new Set(");
const navEnd=html.indexOf("function activate(t)",navStart);
const initStart=html.indexOf("const bangerInitialTab=bangerNavigationTabs.has(");
const initEnd=html.indexOf(";$('tabGames').onclick",initStart);
assert(navStart>=0&&navEnd>navStart&&initStart>=0&&initEnd>initStart,"navigation initialization must be present");
const navSource=html.slice(navStart,navEnd);
const initSource=html.slice(initStart,initEnd+1);
function run(initial){
 let state=initial,replaceCount=0,pushCount=0,active=null;
 const history={
  get state(){return state},
  replaceState(next){state=next;replaceCount++},
  pushState(next){state=next;pushCount++}
 };
 const context={Set,history,location:{href:"https://example.test/"},window:{addEventListener(){}},S:{tab:""},$:()=>({classList:{contains:()=>true}}),closeArena(){},activate(t){active=t;context.S.tab=t;context.bangerRememberTab(t)}};
 vm.createContext(context);
 vm.runInContext(navSource+"\nthis.bangerRememberTab=bangerRememberTab;",context);
 vm.runInContext(initSource,context);
 return {state,replaceCount,pushCount,active};
}
let result=run(null);
assert.equal(result.active,"dashboard","first visit should open dashboard");
assert.equal(result.state.bangerTab,"dashboard");
assert.equal(result.replaceCount,1);
assert.equal(result.pushCount,0,"initialization must not add Back history");
result=run({bangerTab:"skaters"});
assert.equal(result.active,"skaters","reload should preserve statistics");
assert.equal(result.replaceCount,0,"valid tab should preserve existing history entry");
assert.equal(result.pushCount,0);
result=run({bangerTab:"games"});
assert.equal(result.active,"games","reload should preserve games");
assert.equal(result.replaceCount,0);
result=run({bangerTab:"news",bangerModal:true});
assert.equal(result.active,"news","reload should preserve tab beneath LIVE detail");
assert.equal(result.state.bangerModal,undefined,"reload must not resurrect closed detail");
assert.equal(result.replaceCount,1);
result=run({bangerTab:"unknown"});
assert.equal(result.active,"dashboard","unknown history state must fall back to dashboard");
assert.equal(result.state.bangerTab,"dashboard");
assert.equal(result.pushCount,0);
console.log("STAB-04.3 reload tab restoration regression tests passed");
