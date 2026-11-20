const test=require('node:test');const assert=require('node:assert/strict');const {create}=require('../video/live-refresh.js');
test('refresh is suppressed for hidden or stale game',async()=>{
 let current=true,visible=false,calls=0;const c=create({fetchLanding:async()=>{calls++;return {}},apply:()=>{},isCurrent:()=>current,isVisible:()=>visible});
 assert.equal(await c.tick(),false);visible=true;current=false;assert.equal(await c.tick(),false);assert.equal(calls,0);
});
test('stale response after stop cannot mutate the game',async()=>{
 let resolve;let applied=0;const c=create({fetchLanding:()=>new Promise(r=>resolve=r),apply:()=>applied++,isCurrent:()=>true,isVisible:()=>true});
 const pending=c.tick();c.stop();resolve({});assert.equal(await pending,false);assert.equal(applied,0);
});
test('concurrent refreshes are deduplicated',async()=>{
 let resolve,calls=0;const c=create({fetchLanding:()=>{calls++;return new Promise(r=>resolve=r)},apply:()=>{},isCurrent:()=>true,isVisible:()=>true});
 const a=c.tick();assert.equal(await c.tick(),false);resolve({});assert.equal(await a,true);assert.equal(calls,1);
});
