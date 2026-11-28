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
        const kind=url.searchParams.get('kind');
        const game=(id,date,state,home,away)=>({id,startTimeUTC:date,gameState:state,homeTeam:{abbrev:'DAL',score:home},awayTeam:{abbrev:'COL',score:away},gameOutcome:{lastPeriodType:'REG'}});
        const fixtures={clubschedule:{games:[game(1,'2020-01-01T00:00:00Z','FINAL',4,2),game(2,'2099-01-01T00:00:00Z','FUT',0,0)]},standings:{standings:[{teamAbbrev:{default:'DAL'},points:42,divisionSequence:2,conferenceSequence:3}]},clubstats:{skaters:[{firstName:{default:'Fixture'},lastName:{default:'Skater'},points:32}],goalies:[{firstName:{default:'Fixture'},lastName:{default:'Goalie'},wins:12,savePercentage:.924}]},roster:{forwards:[{firstName:'Fixture',lastName:'Forward'}],defensemen:[{firstName:'Fixture',lastName:'Defender'}],goalies:[{firstName:'Fixture',lastName:'Goalie'}]}};
        if(fixtures[kind])return route.fulfill({json:fixtures[kind],headers:{'access-control-allow-origin':'*'}});
        if(kind==='moneypuck'){const entity=url.searchParams.get('entity');const csv={teams:'team,situation,xGoalsFor,xGoalsAgainst,corsiPercentage,fenwickPercentage\\nDAL,5on5,84,71,.53,.52',goalies:'team,situation,playerId,name,xGoals,goals\\nDAL,all,1,Fixture Goalie,30,25',skaters:'team,situation,playerId,name,I_F_xGoals,I_F_goals,onIce_xGoalsPercentage\\nDAL,5on5,2,Fixture Skater,8,7,.54'}[entity];return route.fulfill({body:csv.replaceAll('\\n','\n'),headers:{'access-control-allow-origin':'*'}})}
        return route.abort();
      });
      await page.selectOption('#team','BOS');
      await page.selectOption('#team','DAL');
      await page.locator('.form-chip').first().waitFor();
      await page.locator('.player-row').first().waitFor();
      await page.locator('.metric-fill').first().waitFor();
      assert.equal(await page.locator('.form-chip').count(),2);
      assert.equal(await page.locator('.metric-fill').count(),3);
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
