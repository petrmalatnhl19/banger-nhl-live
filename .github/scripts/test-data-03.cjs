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
function specialistEvidence(team,selected,roster){
 const e=selected.sourceEvidence;
 if(selected.source!=='https://themorningpuck.com/starting-goalies'||selected.status!=='projected'||!e)return false;
 const names={NYI:'islanders',NYR:'rangers',ANA:'ducks',BOS:'bruins',BUF:'sabres',CAR:'hurricanes',CBJ:'blue jackets',CGY:'flames',CHI:'blackhawks',COL:'avalanche',DAL:'stars',DET:'red wings',EDM:'oilers',FLA:'panthers',LAK:'kings',MIN:'wild',MTL:'canadiens',NJD:'devils',NSH:'predators',OTT:'senators',PHI:'flyers',PIT:'penguins',SEA:'kraken',SJS:'sharks',STL:'blues',TBL:'lightning',TOR:'maple leafs',UTA:'mammoth',VAN:'canucks',VGK:'golden knights',WPG:'jets',WSH:'capitals'};
 const d=new Date(selected.date+'T00:00:00Z');
 if(!Number.isFinite(+d)||!names[team])return false;
 const month=d.toLocaleString('en-US',{month:'long',timeZone:'UTC'}), short=month.slice(0,3), day=d.getUTCDate(), year=d.getUTCFullYear();
 const header=String(e.dateHeader||'').toLowerCase().replace(/[,\.]/g,'').replace(/(\d)(st|nd|rd|th)\b/g,'$1');
 const dated=[selected.date,month+' '+day+' '+year,short+' '+day+' '+year,day+' '+month+' '+year,day+' '+short+' '+year].some(x=>header.includes(x.toLowerCase()));
 return dated&&e.team===team&&e.date===selected.date&&String(e.gameId)===String(selected.gameId)&&!!selected.gameId
 &&norm(e.goalieText)===norm(selected.name)&&new RegExp('\\b'+team+'\\b|'+names[team],'i').test(e.teamContext||'')
 &&/\b(PROJECTED|LIKELY)\b/i.test(e.statusContext||'')&&Number.isFinite(Date.parse(selected.checkedAt))&&Date.parse(selected.checkedAt)<Date.parse(e.startTimeUTC)
 &&roster.some(g=>g.team===team&&norm(g.name)===norm(selected.name)&&String(g.playerId)===String(selected.goalieId));
}
test('DATA-03: selected goalie matches same-day source game evidence',()=>{
 const starters=read('starting_goalies.json'), source=read('rotowire_goalies.json'), roster=read('nhl_goalies.json').goalies;
 for(const [team,selected] of Object.entries(starters.teams)){
  if(selected.source==='https://themorningpuck.com/starting-goalies'){
   assert.ok(specialistEvidence(team,selected,roster),team+' invalid specialist evidence');
   continue;
  }
  const matching=source.games.filter(g=>g.team===team&&g.date===selected.date&&norm(g.goalie)===norm(selected.name));
  assert.ok(matching.length,team+' selected goalie lacks same-day source record');
  assert.ok(matching.some(g=>String(g.gameId)===String(selected.gameId)),team+' selected goalie game mismatch');
 }
});
test('DATA-03: specialist projection requires matching dated identity and pregame evidence',()=>{
 const roster=[{team:'NYI',name:'Ilya Sorokin',playerId:8478009}];
 const row={name:'Ilya Sorokin',goalieId:'8478009',date:'2026-11-28',gameId:2026020423,status:'projected',source:'https://themorningpuck.com/starting-goalies',checkedAt:'2026-11-28T04:57:46Z',sourceEvidence:{team:'NYI',date:'2026-11-28',gameId:2026020423,dateHeader:'November 28, 2026',teamContext:'Islanders',goalieText:'Ilya Sorokin',statusContext:'PROJECTED',startTimeUTC:'2026-11-29T00:00:00Z'}};
 assert.ok(specialistEvidence('NYI',row,roster));
 for(const patch of [{gameId:1},{date:'2026-12-01'},{goalieId:'1'},{status:'confirmed'},{sourceEvidence:null},{checkedAt:'2026-11-29T00:00:00Z'}])assert.ok(!specialistEvidence('NYI',{...row,...patch},roster));
 for(const patch of [{dateHeader:'December 1, 2026'},{teamContext:'Rangers'},{goalieText:'Other Goalie'},{statusContext:'UNKNOWN'}])assert.ok(!specialistEvidence('NYI',{...row,sourceEvidence:{...row.sourceEvidence,...patch}},roster));
});

test('DATA-04: goalie evidence from the future is rejected by the game panel',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','..','index.html'),'utf8');
 assert.ok(html.includes('Date.now()-Date.parse(checkedAt)>=0&&Date.now()-Date.parse(checkedAt)<24*3600000'));
});

const {selectPregameGoalie, selectOfficialStarter} = require('../../goalie-selection.js');
test('GOALIE-01: NHL game day, conflict, identity, confirmation and observation cutoff', () => {
 const date = '2026-11-21', checkedAt = date+'T16:23:24Z';
 const game = {id:2026020365, gameDate:date, startTimeUTC:'2026-11-22T00:00:00Z',
               awayTeam:{abbrev:'PHI'}, homeTeam:{abbrev:'MTL'}};
 const row = {name:'Jacob Fowler',date,gameId:game.id,status:'confirmed',source:'https://example.org',checkedAt};
 const daily = {date,updatedAt:checkedAt,teams:{MTL:row}};
 const secondary = {updatedAt:checkedAt,games:[{...row,team:'MTL',opponent:'PHI',goalie:row.name}]};
 const now = Date.parse(date+'T17:30:00Z');
 const select = (feed, time=now) => selectPregameGoalie(game,'MTL',feed,secondary,time);
 assert.equal(select(daily).status,'projected');
 assert.equal(select({...daily,conflicts:[{team:'MTL',date,gameId:game.id}]}),null);
 assert.equal(select({...daily,teams:{}}),null);
 assert.equal(select({...daily,teams:{MTL:{...row,gameId:123}}}),null);
 const confirmed = {...row,confirmationBasis:'explicit_pregame_report',confirmationEvidence:'Named starter'};
 assert.equal(select({...daily,teams:{MTL:confirmed}}).status,'confirmed');
 assert.equal(select({...daily,teams:{MTL:{...confirmed,checkedAt:game.startTimeUTC}}},Date.parse(game.startTimeUTC)),null);
 assert.equal(select({...daily,updatedAt:'2026-11-18T12:00:00Z'}),null);
});

test('Official starter is unique even when relief appears first and plays longer', () => {
 const relief = {playerId:8483532, starter:false, toi:'30:51'};
 const starter = {playerId:8479973, starter:true, toi:'29:09'};
 assert.equal(selectOfficialStarter([relief, starter]), starter);
 assert.equal(selectOfficialStarter([relief, {...starter, starter:null}]), null);
 assert.equal(selectOfficialStarter([{...relief, starter:'N'}]), null);
 assert.equal(selectOfficialStarter([{...relief, starter:true}, starter]), null);
});
