'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=name=>JSON.parse(fs.readFileSync(name,'utf8'));
test('DATA-08: projected lineup coverage and report represent exactly the same NHL teams',()=>{
 const coverage=read('lineups_coverage.json'),report=read('lineup_core_report.json');
 const names=Object.keys(coverage.teams).sort();
 assert.equal(names.length,32);assert.deepEqual(names,Object.keys(report.teams).sort());
 assert.equal(coverage.totalTeams,32);assert.equal(report.summary.teams,32);
 assert.equal(coverage.withProjectedLines,names.filter(k=>coverage.teams[k].hasProjectedLines).length);
 assert.equal(report.summary.complete,names.filter(k=>report.teams[k].complete).length);
 assert.equal(report.summary.incomplete,names.filter(k=>!report.teams[k].complete&&report.teams[k].status!=='missing_team').length);
 assert.equal(report.summary.missing,names.filter(k=>report.teams[k].status==='missing_team').length);
 for(const name of names){
  const c=coverage.teams[name],r=report.teams[name];
  assert.equal(typeof c.hasProjectedLines,'boolean',name+' coverage state');
  assert.ok(Number.isInteger(r.forwardLines)&&r.forwardLines>=0,name+' forward lines');
  assert.ok(Number.isInteger(r.defensePairs)&&r.defensePairs>=0,name+' defense pairs');
  if(r.complete){assert.equal(r.missingForwardLines,0,name);assert.equal(r.missingDefensePairs,0,name);}
 }
});
test('DATA-08: goalie export never silently presents empty or partial data as complete',()=>{
 const data=read('starting_goalies.json');
 assert.ok(['complete','partial','unavailable'].includes(data.status),'export status must be explicit');
 assert.ok(Array.isArray(data.sourceErrors),'sourceErrors must be an array');
 assert.ok(Array.isArray(data.conflicts),'conflicts must be an array');
 const count=Object.keys(data.teams||{}).length;
 if(count===0)assert.notEqual(data.status,'complete','empty export cannot claim complete coverage');
 if(data.sourceErrors.length)assert.notEqual(data.status,'complete','source errors cannot claim complete coverage');
 for(const [team,entry] of Object.entries(data.teams||{})){
  assert.match(team,/^[A-Z]{2,3}$/);
  assert.ok(['confirmed','projected'].includes(entry.status),team+' goalie status');
  assert.equal(entry.date,data.date,team+' goalie date');
 }
});

test('DATA-08: classify missing goalie data without fabricating starter confirmations',()=>{
 const data=read('starting_goalies.json');
 const count=Object.keys(data.teams||{}).length;
 const errors=data.sourceErrors||[];
 const classification=errors.length?'source_error':count===0?'no_coverage':'available';
 if(errors.length)assert.equal(classification,'source_error');
 if(count===0)assert.notEqual(classification,'available');
 if(data.status==='complete')assert.equal(classification,'available');
 const checked=Date.parse(data.updatedAt||'');
 assert.ok(Number.isFinite(checked),'goalie export timestamp missing');
 assert.equal(new Date(checked).toISOString().slice(0,10),data.date,'goalie export date does not match UTC timestamp');
});
test('DATA-08: lineup missing and freshness categories are disjoint and exhaustive',()=>{
 const coverage=read('lineups_coverage.json');
 const names=Object.keys(coverage.teams);
 const missing=new Set(coverage.missing),stale=new Set(coverage.needsFreshProjection);
 assert.equal(missing.size,coverage.missing.length);
 assert.equal(stale.size,coverage.needsFreshProjection.length);
 for(const name of [...missing,...stale])assert.ok(coverage.teams[name],name+' unknown team');
 for(const name of names){
  const entry=coverage.teams[name];
  assert.equal(missing.has(name),!entry.hasProjectedLines,name+' missing flag inconsistent');
  if(entry.currentProjection)assert.ok(!stale.has(name)&&!missing.has(name),name+' fresh and stale simultaneously');
  if(!entry.currentProjection&&entry.hasProjectedLines)assert.ok(stale.has(name),name+' stale projection not flagged');
 }
});
