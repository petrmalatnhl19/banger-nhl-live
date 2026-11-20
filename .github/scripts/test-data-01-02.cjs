'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname,'..','..',name),'utf8'));
test('DATA-01: coverage and core report agree on all 32 team identities', () => {
 const coverage=read('lineups_coverage.json'), report=read('lineup_core_report.json');
 const coverageTeams=Object.keys(coverage.teams), reportTeams=Object.keys(report.teams);
 assert.equal(coverage.totalTeams,32);
 assert.equal(coverageTeams.length,32);
 assert.deepEqual(coverageTeams.sort(),reportTeams.sort());
 const values=Object.values(report.teams);
 assert.equal(report.summary.complete,values.filter(v=>v.complete===true).length);
 assert.equal(report.summary.missing,values.filter(v=>v.status==='missing_team').length);
 assert.equal(report.summary.incomplete,values.filter(v=>!v.complete&&v.status!=='missing_team').length);
 assert.equal(report.summary.complete+report.summary.incomplete+report.summary.missing,32);
 assert.equal(coverage.currentProjections+coverage.needsFreshProjection.length,32);
});
test('DATA-02: every published starter has explicit status and same-date evidence', () => {
 const data=read('starting_goalies.json');
 assert.match(data.date,/^\d{4}-\d{2}-\d{2}$/);
 for(const [team,entry] of Object.entries(data.teams)){
  assert.match(team,/^[A-Z]{2,3}$/);
  assert.ok(['projected','confirmed'].includes(entry.status),team+' invalid status');
  assert.equal(entry.date,data.date,team+' mismatched date');
  assert.ok(entry.name&&typeof entry.name==='string',team+' missing name');
  assert.ok(/^https:\/\//.test(entry.source||''),team+' missing evidence URL');
  assert.ok(!Number.isNaN(Date.parse(entry.checkedAt)),team+' missing check timestamp');
 }
 for(const conflict of data.conflicts||[]) {
  assert.ok(conflict.team&&conflict.rotowire&&conflict.previous,'invalid goalie conflict: '+JSON.stringify(conflict));
  assert.ok(conflict.rotowire!==conflict.previous,'identical conflict values');
 }
});
test('DATA-02: frontend preserves projected vs confirmed wording',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 assert.match(html,/status==='confirmed'\?'Potvrzený start':'Předpokládaný start'/);
 assert.match(html,/status==='confirmed'\|\|status==='projected'/);
});
