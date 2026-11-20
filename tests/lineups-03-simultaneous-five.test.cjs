'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {simultaneousFiveSkaterWindows:calc}=require('../scripts/lineups_simultaneous_five_audit.cjs');
const rows=(teamId,count,start=0,end=10)=>Array.from({length:count},(_,i)=>({teamId,playerId:teamId*100+i,start,end}));
test('finds only intervals with exactly five on both teams',()=>{
 const r=calc([...rows(13,5),...rows(22,5,3,8)],[13,22],10);
 assert.deepEqual(r.windows,[{start:3,end:8}]);assert.equal(r.seconds,5);assert.equal(r.verifiedStrength,false);
});
test('six skaters on one side excludes window',()=>{
 const r=calc([...rows(13,6),...rows(22,5)],[13,22],10);assert.equal(r.seconds,0);
});
test('duplicate shifts fail closed',()=>{
 const a=rows(13,5),b=rows(22,5);
 assert.equal(calc([...a,a[0],...b],[13,22],10).status,'unverified');
});
test('invalid team IDs rejected',()=>assert.equal(calc([], [13,13]).status,'invalid'));
