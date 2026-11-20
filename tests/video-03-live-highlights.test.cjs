const assert=require('node:assert/strict');
const test=require('node:test');
const {collect,safeUrl}=require('../video/live-highlights.js');
test('only trusted HTTPS NHL links are accepted',()=>{
  assert.equal(safeUrl('http://www.nhl.com/watch/foo'),null);
  assert.equal(safeUrl('https://nhl.com.evil.test/video'),null);
  assert.equal(safeUrl('javascript:alert(1)'),null);
  assert.equal(safeUrl('https://www.nhl.com/video/foo'),'https://www.nhl.com/video/foo');
});
test('goal events map to pending or official link without inventing media',()=>{
 const data={summary:{scoring:[{goals:[{eventId:13,highlightClip:45,highlightClipSharingUrl:'https://www.nhl.com/video/goal'},{eventId:14},{eventId:13}]}]}};
 assert.deepEqual(collect(2026020335,data),[
  {gameId:'2026020335',eventId:13,clipId:'45',officialUrl:'https://www.nhl.com/video/goal',status:'link-available'},
  {gameId:'2026020335',eventId:14,clipId:null,officialUrl:null,status:'pending'}
 ]);
});
test('invalid input is harmless',()=>{
 assert.deepEqual(collect('invalid',{}),[]);
 assert.deepEqual(collect(2026020335,null),[]);
 assert.deepEqual(collect(2026020335,{summary:{scoring:[]}}),[]);
});
