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
