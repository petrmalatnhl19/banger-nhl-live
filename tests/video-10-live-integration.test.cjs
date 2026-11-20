const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
test('live video refresh is wired into game detail and stops on close',()=>{
 assert.match(html,/video\/live-refresh\.js\?v=video10/);
 assert.match(html,/data-video-event/);
 assert.match(html,/bangerVideoRefresh\.start\(\)/);
 assert.match(html,/function closeArena\(fromHistory=false\)\{if\(bangerVideoRefresh\)/);
 assert.match(html,/async function detail\(id,b\)\{if\(bangerVideoRefresh\)/);
 assert.match(html,/expectedRequest===bangerDetailRequestId/);
 assert.match(html,/isVisible:\(\)=>!document\.hidden/);
 assert.match(html,/holder\.appendChild\(a\)/);
 assert.match(html,/rel='noopener noreferrer'/);
});
