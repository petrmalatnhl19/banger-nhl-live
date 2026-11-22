'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'..','..',name),'utf8'));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
test('DATA-03: published starting goalies belong to their NHL team roster',()=>{
 const starters=read('starting_goalies.json');
 const goalieList=read('nhl_goalies.json');
 assert.equal(goalieList.teamCount,32);
 const roster=new Map();
 for(const goalie of goalieList.goalies){
  const team=goalie.team;
  if(!roster.has(team))roster.set(team,new Set());
  roster.get(team).add(norm(goalie.name));
 }
 for(const [team,entry] of Object.entries(starters.teams)){
  assert.ok(roster.has(team),team+' not present in roster');
  assert.ok(roster.get(team).has(norm(entry.name)),team+' starter not on team roster: '+entry.name);
 }
});
test('DATA-03: source conflicts preserve both names without pretending to confirm a starter',()=>{
 const starters=read('starting_goalies.json');
 const seen=new Set();
 for(const c of starters.conflicts||[]){
  const rotowirePair=c.rotowire&&c.previous;
  const specialistPair=c.specialist&&c.nhl;
  const gameReason=c.gameId!=null&&typeof c.reason==='string'&&c.reason.length>0;
  assert.ok(c.team&&(rotowirePair||specialistPair||gameReason),c.team+' incomplete conflict evidence');
  if(rotowirePair) assert.notEqual(norm(c.rotowire),norm(c.previous),c.team+' same RotoWire candidate in conflict');
  if(specialistPair) assert.notEqual(norm(c.specialist),norm(c.nhl),c.team+' same specialist/NHL candidate in conflict');
  assert.ok(!seen.has(c.team),c.team+' duplicate conflict');
  seen.add(c.team);
  const chosen=starters.teams[c.team];
  if(chosen) assert.notEqual(chosen.status,'confirmed',c.team+' conflicting sources must not imply confirmation');
 }
});
test('DATA-03: selected goalie matches same-day RotoWire game evidence',()=>{
 const starters=read('starting_goalies.json'), source=read('rotowire_goalies.json');
 for(const [team,selected] of Object.entries(starters.teams)){
  const matching=source.games.filter(g=>g.team===team&&g.date===selected.date&&norm(g.goalie)===norm(selected.name));
  assert.ok(matching.length,team+' selected goalie lacks same-day source record');
  assert.ok(matching.some(g=>String(g.gameId)===String(selected.gameId)),team+' selected goalie game mismatch');
 }
});

test('DATA-04: goalie evidence from the future is rejected by the game panel',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 assert.ok(html.includes('Date.now()-Date.parse(checkedAt)>=0&&Date.now()-Date.parse(checkedAt)<24*3600000'));
});
