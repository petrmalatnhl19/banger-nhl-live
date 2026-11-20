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

test('new match can refresh immediately while previous stopped request is unresolved',async()=>{
 let firstResolve,secondResolve,calls=0,applied=[];
 const c=create({fetchLanding:()=>{calls++;return new Promise(r=>{if(calls===1)firstResolve=r;else secondResolve=r})},apply:d=>applied.push(d.game),isCurrent:()=>true,isVisible:()=>true});
 const old=c.tick();c.stop();const fresh=c.tick();
 assert.equal(calls,2);secondResolve({game:'new'});assert.equal(await fresh,true);
 firstResolve({game:'old'});assert.equal(await old,false);
 assert.deepEqual(applied,['new']);
});
test('hidden during pending fetch prevents applying the response',async()=>{
 let resolve,visible=true,applied=0;
 const c=create({fetchLanding:()=>new Promise(r=>resolve=r),apply:()=>applied++,isCurrent:()=>true,isVisible:()=>visible});
 const pending=c.tick();visible=false;resolve({});assert.equal(await pending,false);assert.equal(applied,0);
});
