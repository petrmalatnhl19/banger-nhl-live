'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {BENCHMARK_2026020335,compareBenchmark}=require('../scripts/lineups_03_36_benchmark.cjs');
const base={gameId:2026020335,sourceRows:1200,rosterCovered:true,verifiedStrength:true,observedLines:BENCHMARK_2026020335.lines.map(x=>({...x,players:[...x.players]}))};
test('real benchmark values compare without promoting to verified',()=>{
 const result=compareBenchmark(base);
 assert.equal(result.status,'benchmark-agreement');assert.equal(result.matched,5);assert.equal(result.publishable,false);assert.equal(result.verifiedUnits,false);
});
test('missing real shift evidence never passes benchmark',()=>{
 for(const change of [{sourceRows:0},{rosterCovered:false},{verifiedStrength:false},{observedLines:null}]){
  const result=compareBenchmark({...base,...change});assert.equal(result.status,'unverified');assert.equal(result.publishable,false);
 }
});
test('detect missing lines, mismatched time, and duplicated records',()=>{
 assert.equal(compareBenchmark({...base,observedLines:base.observedLines.slice(1)}).status,'benchmark-mismatch');
 assert.equal(compareBenchmark({...base,observedLines:base.observedLines.map((x,i)=>i===0?{...x,seconds:x.seconds+10}:x)}).discrepancies.length,1);
 assert.equal(compareBenchmark({...base,observedLines:[...base.observedLines,base.observedLines[0]]}).status,'unverified');
});
test('line order is irrelevant; repeated surnames are preserved',()=>{
 const lines=base.observedLines.map(x=>({...x,players:[...x.players].reverse()}));
 assert.equal(compareBenchmark({...base,observedLines:lines}).status,'benchmark-agreement');
});
