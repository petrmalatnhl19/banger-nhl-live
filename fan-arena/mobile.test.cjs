const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
    const integration=await browser.newPage({viewport:{width:390,height:800}});
    const root=pathToFileURL(path.resolve('index.html')).href;
    // Serve actual local documents over a shared synthetic origin to test storage and navigation.
    const fs=require('node:fs');
    await integration.route('**/*',async r=>{
      const u=new URL(r.request().url());
      if(u.origin!=='https://arena-test.invalid')return r.abort();
      const rel=u.pathname.slice(1)||'index.html';
      const allowed=['index.html','fan-arena/preview.html','fan-arena/themes.js','fan-arena/arena-art.js'];
      if(!allowed.includes(rel)&&!/^fan-arena\/[A-Z]{3}\.webp$/.test(rel))return r.abort();
      return r.fulfill({body:fs.readFileSync(path.resolve(rel)),contentType:rel.endsWith('.webp')?'image/webp':rel.endsWith('.js')?'application/javascript':'text/html'});
    });
    await integration.goto('https://arena-test.invalid/index.html');
    await integration.evaluate(()=>localStorage.setItem('banger-favorite-team-v1','BOS'));
    assert.equal(await integration.locator('#fanArenaDesktopLink').getAttribute('href'),'./fan-arena/preview.html');
    await integration.locator('#fanArenaMobileLink').click();
    await integration.waitForURL('**/fan-arena/preview.html');
    assert.equal(await integration.locator('#team').inputValue(),'BOS');
    await integration.selectOption('#team','TOR');
    assert.equal(await integration.evaluate(()=>localStorage.getItem('banger-favorite-team-v1')),'BOS');
    await integration.goBack();
    await integration.waitForURL('**/index.html');
    await integration.locator('#fanArenaMobileLink').click();
    await integration.waitForURL('**/fan-arena/preview.html');
    await integration.locator('.arena-back').click();
    await integration.waitForURL('**/index.html');
    await integration.close();
    console.log('PASS native arena entry, favorite preference, browser back and explicit return');
    const samples=[];
    for(let i=0;i<10;i++){
      const page=await browser.newPage({viewport:{width:390,height:800},reducedMotion:'reduce'});
      await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
      const start=performance.now();
      await page.goto(pathToFileURL(path.resolve('fan-arena/preview.html')).href);
      await page.locator('#name').waitFor({state:'visible'});
      const ready=performance.now()-start;
      const switches=[];
      for(const code of ['BOS','COL','TOR','DAL']){
        const t=performance.now();await page.selectOption('#team',code);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        switches.push(Math.round(performance.now()-t));
      }
      samples.push({readyMs:Math.round(ready),switchMs:switches});
      await page.close();
    }
    const percentile=(a,p)=>[...a].sort((x,y)=>x-y)[Math.ceil(a.length*p)-1];
    const ready=samples.map(s=>s.readyMs),switches=samples.flatMap(s=>s.switchMs);
    const report={environment:'Headless Chromium, local files, external network blocked; not real-device or API latency',samples,readyMedianMs:percentile(ready,.5),readyP90Ms:percentile(ready,.9),switchMedianMs:percentile(switches,.5),switchP90Ms:percentile(switches,.9)};
    console.log('ARENA PERFORMANCE '+JSON.stringify(report));
    require('node:fs').mkdirSync('fan-arena-screenshots',{recursive:true});
    require('node:fs').writeFileSync('fan-arena-screenshots/performance.json',JSON.stringify(report,null,2));
    for(const width of [360,390,430]){
      const page=await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():route.abort());
      await page.goto(pathToFileURL(path.resolve('fan-arena/preview.html')).href);
      const codes=await page.locator('#team option').evaluateAll(opts=>opts.map(o=>o.value));
      assert.equal(codes.length,32);
      for(const code of codes){
        await page.selectOption('#team',code);
        assert.equal(await page.locator('.arena').getAttribute('data-team'),code);
        assert.ok(await page.locator('#name').innerText());
        assert.ok(await page.locator('#name').evaluate(e=>{const node=e.firstChild;if(!node||node.nodeType!==3)return false;const words=node.textContent.matchAll(/\S+/g);for(const w of words){const r=document.createRange();r.setStart(node,w.index);r.setEnd(node,w.index+w[0].length);const rects=[...r.getClientRects()];if(rects.length!==1||rects[0].right>e.getBoundingClientRect().right+1||rects[0].left<e.getBoundingClientRect().left-1)return false}return true}),width+' '+code+' whole-word title fit');
        assert.equal(await page.locator('.panel').count(),11);
        const art=await page.evaluate(async code=>{const img=new Image();img.src=code+'.webp';await img.decode();const bg=getComputedStyle(document.querySelector('.hero')).backgroundImage;return img.naturalWidth>0&&img.naturalHeight>0&&bg.includes(code+'.webp')},code);
        assert.ok(art,code+' WebP banner decode and application');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+code+' horizontal overflow');
        assert.ok(await page.locator('#team').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}));
      }
      let fixtureCode='DAL';
      await page.unroute('**/*');
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.protocol==='file:')return route.continue();
        if(url.protocol==='https:'&&url.hostname==='assets.nhle.com')return route.continue();
        const kind=url.searchParams.get('kind');
        const game=(id,date,state,home,away)=>({id,startTimeUTC:date,gameState:state,homeTeam:{abbrev:fixtureCode,score:home},awayTeam:{abbrev:fixtureCode==='COL'?'DAL':'COL',score:away},gameOutcome:{lastPeriodType:'REG'}});
        const fixtures={clubschedule:{games:[...Array.from({length:10},(_,i)=>game(i+10,new Date(Date.UTC(2020,0,i+1)).toISOString(),'FINAL',i%3?4:2,i%3?2:4)),game(2,'2099-01-01T00:00:00Z','FUT',0,0)]},standings:{standings:[{teamAbbrev:{default:fixtureCode},points:42,divisionSequence:2,conferenceSequence:3}]},clubstats:{skaters:[{firstName:{default:'Fixture'},lastName:{default:'Skater'},points:32,sweaterNumber:21,positionCode:'L',headshot:'https://assets.nhle.com/mugs/nhl/20252026/DAL/8480027.png'}],goalies:[{firstName:{default:'Fixture'},lastName:{default:'Goalie'},wins:12,savePercentage:.924,sweaterNumber:29,positionCode:'G'}]},roster:{forwards:[{firstName:'Fixture',lastName:'Forward'}],defensemen:[{firstName:'Fixture',lastName:'Defender'}],goalies:[{firstName:'Fixture',lastName:'Goalie'}]}};
        if(fixtures[kind])return route.fulfill({json:fixtures[kind],headers:{'access-control-allow-origin':'*'}});
        if(kind==='moneypuck'){const entity=url.searchParams.get('entity');const csv={teams:'team,situation,xGoalsFor,xGoalsAgainst,corsiPercentage,fenwickPercentage\\nDAL,5on5,84,71,.53,.52',goalies:'team,situation,playerId,name,xGoals,goals\\nDAL,all,1,Fixture Goalie,30,25',skaters:'team,situation,playerId,name,I_F_xGoals,I_F_goals,onIce_xGoalsPercentage\\nDAL,5on5,2,Fixture Skater,8,7,.54'}[entity];return route.fulfill({body:csv.replaceAll('DAL,',fixtureCode+',').replaceAll('\\n','\n'),headers:{'access-control-allow-origin':'*'}})}
        return route.abort();
      });
      for(const code of codes){
      fixtureCode=code;
      await page.selectOption('#team',code==='BOS'?'DAL':'BOS');
      await page.selectOption('#team',code);
      await page.waitForFunction(()=>document.querySelectorAll('.form-chip').length===15&&document.querySelectorAll('.metric-fill').length===3&&document.querySelectorAll('.player-meta').length===2);
      assert.equal(await page.locator('#club-logo').getAttribute('src'),'https://assets.nhle.com/logos/nhl/svg/'+code+'_dark.svg');
      await page.locator('.form-chip').first().waitFor();
      await page.locator('.player-row').first().waitFor();
      await page.locator('.metric-fill').first().waitFor();
      assert.equal(await page.locator('.form-chip').count(),15);
      assert.equal(await page.locator('.scoreboard[role="img"][aria-label]').count(),2);
      assert.match(await page.locator('.scoreboard').first().getAttribute('aria-label'),/\d+ : \d+/);
      assert.equal(await page.locator('.metric-fill').count(),3);
      assert.equal(await page.locator('.player-meta').count(),2);
      const pair=await page.locator('.metric-pair').evaluateAll(els=>els.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
      assert.equal(pair.length,2);assert.equal(pair[0].y,pair[1].y);assert.ok(pair[1].x>pair[0].x);
      await page.locator('.roster-group summary').first().click();
      assert.equal(await page.locator('.roster-group').first().getAttribute('open'),'');
      await page.locator('.roster-group summary').first().click();
      if(width===390||code==='DAL'){
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('.score-team img,.player-row img,.dallas-identity img')).every(img=>img.complete),{},{timeout:15000}).catch(()=>{});
      console.log('NHL image diagnostic',await page.locator('.score-team img,.player-row img,.dallas-identity img').evaluateAll(els=>els.map(e=>({url:e.src,loaded:e.complete&&e.naturalWidth>0}))));
      assert.equal(await page.locator('.roster-group').count(),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      require('node:fs').mkdirSync('fan-arena-screenshots',{recursive:true});
      await page.screenshot({path:'fan-arena-screenshots/'+code+'-fixture-'+width+'.png',fullPage:true});
      }
      }
      assert.deepEqual(errors,[]);
      await page.close();
      console.log('PASS '+width+'px: 32 clubs');
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
