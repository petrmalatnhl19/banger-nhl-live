'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','..',name),'utf8'));
const parse=(value,label)=>{const n=Date.parse(value||'');assert.ok(Number.isFinite(n),label+' invalid timestamp');return n;};
test('DATA-05: lineup publication freshness is consistent with 36h threshold',()=>{
 const coverage=read('lineups_coverage.json');
 const generated=parse(coverage.generatedAt,'coverage generatedAt');
 assert.equal(coverage.totalTeams,32);
 assert.match(coverage.freshnessDefinition,/36h/);
 for(const [team,entry] of Object.entries(coverage.teams)){
  if(!entry.publishedAt){assert.equal(entry.currentProjection,false,team+' undated projection cannot be current');continue;}
  const age=generated-parse(entry.publishedAt,team+' publishedAt');
  const current=age>=0&&age<36*60*60*1000;
  assert.equal(entry.currentProjection,current,team+' freshness disagrees with publication age');
  if(entry.currentProjection)assert.equal(entry.needsFreshProjection,false,team+' fresh projection flagged stale');
 }
 assert.equal(coverage.currentProjections,Object.values(coverage.teams).filter(v=>v.currentProjection).length);
 assert.deepEqual([...coverage.needsFreshProjection].sort(),Object.entries(coverage.teams).filter(([,v])=>v.needsFreshProjection).map(([k])=>k).sort());
});
test('DATA-05: core freshness buckets are consistent with report generation time',()=>{
 const report=read('lineup_core_report.json');
 const generated=parse(report.generatedAt,'core report generatedAt');
 const buckets={recent_24h:0,aging_24_72h:0,historical_over_72h:0,undated:0};
 for(const [team,entry] of Object.entries(report.teams)){
  if(entry.status==='missing_team')continue;
  let bucket='undated';
  if(entry.publishedAt){
   const age=generated-parse(entry.publishedAt,team+' publishedAt');
   assert.ok(age>=0,team+' future-dated publication');
   bucket=age<24*3600000?'recent_24h':age<72*3600000?'aging_24_72h':'historical_over_72h';
  }
  assert.equal(entry.freshness,bucket,team+' incorrect freshness category');
  buckets[bucket]++;
 }
 assert.deepEqual(report.summary.freshness,buckets);
});
test('DATA-05: goalie evidence generation is not older than the selected checks',()=>{
 const data=read('starting_goalies.json');
 const updated=parse(data.updatedAt,'starting goalies updatedAt');
 for(const [team,entry] of Object.entries(data.teams)){
  const checked=parse(entry.checkedAt,team+' checkedAt');
  assert.ok(checked<=updated+60*1000,team+' check timestamp after export');
 }
});
