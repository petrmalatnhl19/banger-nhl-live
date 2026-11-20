const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
test('match goal pane wires verified clip metadata without replacing current game fetch',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 assert.match(html,/video\/live-highlights\.js\?v=video07/);
 assert.match(html,/video\/goal-video-map\.js\?v=video07/);
 assert.match(html,/BangerLiveHighlights\?\.collect\(id,d\)/);
 assert.match(html,/BangerGoalVideoMap\?\.mapGoals\(id,d,videoClips\)/);
 assert.match(html,/Přehrát gól na NHL\.com/);
 assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/gamecenter\/'\+id\+'\/landing/);
});
