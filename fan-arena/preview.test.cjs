const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/preview.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
test('inline script compiles and all eleven panels exist',()=>{
 new vm.Script(script);
 assert.equal((html.match(/class="panel"/g)||[]).length,11);
});
test('CSV parser preserves quoted commas, escaped quotes and missing values',()=>{
 const start=script.indexOf('function mpParseCSV(');
 const end=script.indexOf('let requestId=',start);
 const parse=vm.runInNewContext(script.slice(start,end)+';mpParseCSV');
 const rows=JSON.parse(JSON.stringify(parse('team,name,xGoals\r\nDAL,"A, B",2.5\r\nDAL,"A ""B""",\r\n')));
 assert.deepEqual(rows,[{team:'DAL',name:'A, B',xGoals:'2.5'},{team:'DAL',name:'A "B"',xGoals:''}]);
});
test('preview is isolated and uses text rendering',()=>{
 assert.match(script,/id===requestId/);
 assert.match(script,/controller\?\.abort\(\)/);
 assert.doesNotMatch(script,/\.innerHTML\s*=/);
 assert.match(script,/url\.protocol!=='https:'/);
});

function harness(fetch){
 const panels=Array.from({length:11},()=>({textContent:''}));
 const select={value:'DAL',append(){},addEventListener(){}};
 const nodes={team:select,name:{},tagline:{}};
 const context=vm.createContext({document:{getElementById:k=>nodes[k],querySelector:()=>({dataset:{},style:{setProperty(){}}}),querySelectorAll:()=>panels,createElement:()=>({})},BangerArenaThemes:{codes:['DAL','BOS'],get:code=>({code})},fetch,URL,AbortController,setTimeout,clearTimeout});
 vm.runInContext(script.replace(/loadClub\(\);\s*$/,''),context);
 return {panels,select,load:()=>vm.runInContext('loadClub()',context)};
}
test('API failures settle every panel without fabricated statistics',async()=>{
 const h=harness(async()=>{throw Error('offline')});
 await h.load();
 assert.ok(h.panels.every(p=>/nedostup|nejsou dostup|není dostup/i.test(p.textContent)));
});
test('late previous-team response cannot overwrite current standings',async()=>{
 let release;
 const delayed=new Promise(r=>release=r);
 let first=true;
 const h=harness(async url=>{
  if(new URL(url,'https://example.test').searchParams.get('kind')!=='standings')throw Error('fixture unavailable');
  if(first){first=false;return delayed}
  return {ok:true,json:async()=>({standings:[{teamAbbrev:{default:'BOS'},points:42}]})};
 });
 const old=h.load();h.select.value='BOS';await h.load();
 assert.match(h.panels[3].textContent,/42/);
 release({ok:true,json:async()=>({standings:[{teamAbbrev:{default:'DAL'},points:99}]})});
 await old;
 assert.match(h.panels[3].textContent,/42/);
 assert.doesNotMatch(h.panels[3].textContent,/99/);
});

test('official NHL goalie savePercentage and legacy fallback preserve valid zero and missing data',async()=>{
 const h=harness(async url=>{
  if(new URL(url,'https://example.test').searchParams.get('kind')!=='clubstats')throw Error('fixture unavailable');
  return {ok:true,json:async()=>({goalies:[
   {firstName:{default:'Official'},wins:5,savePercentage:0.922652,savePctg:0.8},
   {firstName:{default:'Legacy'},wins:2,savePctg:0},
   {firstName:{default:'Missing'},wins:1,savePercentage:1.2}
  ]})};
 });
 await h.load();
 assert.equal(h.panels[5].textContent,'Official · 5 V · SV% 92.3 % | Legacy · 2 V · SV% 0.0 % | Missing · 1 V · SV% —');
});
