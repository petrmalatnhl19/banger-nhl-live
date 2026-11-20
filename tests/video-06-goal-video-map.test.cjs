const test=require('node:test');
const assert=require('node:assert/strict');
const {mapGoals}=require('../video/goal-video-map.js');
test('matches only the correct game and goal event',()=>{
 const game=2026020335, landing={summary:{scoring:[{goals:[{eventId:10},{eventId:11}]},{goals:[{eventId:12}]}]}};
 const clips=[{gameId:String(game),eventId:10,status:'link-available',officialUrl:'https://www.nhl.com/video/one'},{gameId:'2026020336',eventId:11,status:'link-available',officialUrl:'https://www.nhl.com/video/wrong'},{gameId:String(game),eventId:12,status:'pending'}];
 const mapped=mapGoals(game,landing,clips);
 assert.equal(mapped.length,2);
 assert.equal(mapped[0].goals[0].video.eventId,10);
 assert.equal(mapped[0].goals[1].video,null);
 assert.equal(mapped[1].goals[0].video,null);
});
test('missing game data and clips are harmless',()=>{
 assert.deepEqual(mapGoals(2026020335,null,[]),[]);
 assert.equal(mapGoals(2026020335,{summary:{scoring:[{goals:[{}]}]}},[])[0].goals[0].video,null);
});
