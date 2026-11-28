const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({headless:true});
  try{
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
        assert.equal(await page.locator('.panel').count(),11);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),width+' '+code+' horizontal overflow');
        assert.ok(await page.locator('#team').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1}));
      }
      await page.selectOption('#team','DAL');
      await page.unroute('**/*');
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.protocol==='file:')return route.continue();
        if(url.protocol==='https:'&&url.hostname==='assets.nhle.com')return route.continue();
        const kind=url.searchParams.get('kind');
        const game=(id,date,state,home,away)=>({id,startTimeUTC:date,gameState:state,homeTeam:{abbrev:'DAL',score:home},awayTeam:{abbrev:'COL',score:away},gameOutcome:{lastPeriodType:'REG'}});
        const fixtures={clubschedule:{games:[...Array.from({length:10},(_,i)=>game(i+10,new Date(Date.UTC(2020,0,i+1)).toISOString(),'FINAL',i%3?4:2,i%3?2:4)),game(2,'2099-01-01T00:00:00Z','FUT',0,0)]},standings:{standings:[{teamAbbrev:{default:'DAL'},points:42,divisionSequence:2,conferenceSequence:3}]},clubstats:{skaters:[{firstName:{default:'Fixture'},lastName:{default:'Skater'},points:32,sweaterNumber:21,positionCode:'L',headshot:'https://assets.nhle.com/mugs/nhl/20252026/DAL/8480027.png'}],goalies:[{firstName:{default:'Fixture'},lastName:{default:'Goalie'},wins:12,savePercentage:.924,sweaterNumber:29,positionCode:'G'}]},roster:{forwards:[{firstName:'Fixture',lastName:'Forward'}],defensemen:[{firstName:'Fixture',lastName:'Defender'}],goalies:[{firstName:'Fixture',lastName:'Goalie'}]}};
        if(fixtures[kind])return route.fulfill({json:fixtures[kind],headers:{'access-control-allow-origin':'*'}});
        if(kind==='moneypuck'){const entity=url.searchParams.get('entity');const csv={teams:'team,situation,xGoalsFor,xGoalsAgainst,corsiPercentage,fenwickPercentage\\nDAL,5on5,84,71,.53,.52',goalies:'team,situation,playerId,name,xGoals,goals\\nDAL,all,1,Fixture Goalie,30,25',skaters:'team,situation,playerId,name,I_F_xGoals,I_F_goals,onIce_xGoalsPercentage\\nDAL,5on5,2,Fixture Skater,8,7,.54'}[entity];return route.fulfill({body:csv.replaceAll('\\n','\n'),headers:{'access-control-allow-origin':'*'}})}
        return route.abort();
      });
      await page.selectOption('#team','BOS');
      await page.selectOption('#team','DAL');
      await page.locator('.form-chip').first().waitFor();
      await page.locator('.player-row').first().waitFor();
      await page.locator('.metric-fill').first().waitFor();
      assert.equal(await page.locator('.form-chip').count(),15);
      assert.equal(await page.locator('.metric-fill').count(),3);
      assert.equal(await page.locator('.player-meta').count(),2);
      const pair=await page.locator('.metric-pair').evaluateAll(els=>els.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
      assert.equal(pair.length,2);assert.equal(pair[0].y,pair[1].y);assert.ok(pair[1].x>pair[0].x);
      await page.locator('.roster-group summary').first().click();
      assert.equal(await page.locator('.roster-group').first().getAttribute('open'),'');
      await page.locator('.roster-group summary').first().click();
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('.score-team img,.player-row img,.dallas-identity img')).every(img=>img.complete),{},{timeout:15000}).catch(()=>{});
      console.log('NHL image diagnostic',await page.locator('.score-team img,.player-row img,.dallas-identity img').evaluateAll(els=>els.map(e=>({url:e.src,loaded:e.complete&&e.naturalWidth>0}))));
      assert.equal(await page.locator('.roster-group').count(),3);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      require('node:fs').mkdirSync('fan-arena-screenshots',{recursive:true});
      await page.screenshot({path:'fan-arena-screenshots/dallas-fixture-'+width+'.png',fullPage:true});
      assert.deepEqual(errors,[]);
      await page.close();
      console.log('PASS '+width+'px: 32 clubs');
    }
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
