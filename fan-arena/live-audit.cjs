const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('fan-arena/preview.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const codes=[...script.matchAll(/\['([A-Z]{3})','[^']+'\]/g)].slice(0,32).map(m=>m[1]);
if(new Set(codes).size!==32)throw Error('Expected 32 clubs');
function node(){let text='';return {get textContent(){return text+this.childNodes.map(n=>n.textContent).join('')},set textContent(v){text=String(v);this.childNodes=[]},childNodes:[],append(...x){this.childNodes.push(...x)},replaceChildren(){text='';this.childNodes=[]},addEventListener(){}}}
const panels=Array.from({length:11},node),select=node();
const nodes={team:select,name:node(),tagline:node()};
const cache=new Map();
const requests=[];
async function read(input,opts){
 const url=String(input);
 const key=url;
 if(!cache.has(key)){
  cache.set(key,(async()=>{
   try{
    if(url==='../nhl_news.json')return {ok:true,body:fs.readFileSync('nhl_news.json','utf8'),status:200};
    const r=await fetch(input,{headers:opts?.headers,signal:AbortSignal.timeout(10000)});
    const body=await r.text();requests.push({url,status:r.status,bytes:body.length});
    return {ok:r.ok,body,status:r.status};
   }catch(e){requests.push({url,error:e.message});return {ok:false,body:'',status:0}}
  })());
 }
 const r=await cache.get(key);
 return {ok:r.ok,status:r.status,json:async()=>JSON.parse(r.body),text:async()=>r.body};
}
const ctx=vm.createContext({document:{getElementById:k=>nodes[k],querySelector:()=>({dataset:{},style:{setProperty(){}}}),querySelectorAll:()=>panels,createElement:node},BangerArenaThemes:{codes,get:code=>({code})},URL,AbortController,fetch:read,setTimeout,clearTimeout});
vm.runInContext(script.replace(/loadClub\(\);\s*$/,''),ctx);
(async()=>{
 const report=[];
 for(const code of codes){
  select.value=code;
  await vm.runInContext('loadClub()',ctx);
  const values=panels.map(p=>p.textContent);
  const missing=values.map((v,i)=>!v||/nedostup|nejsou dostup|není dostup|Žádné jednoznačně|Načítám|—/.test(v)?i+1:null).filter(Boolean);
  const newsEmpty=values[7]==='Žádné jednoznačně přiřazené novinky.';
  const gaps=missing.filter(i=>i!==8||!newsEmpty);
  const stats=await (await read(new URL('https://xxwqeiuyislnoxsmjuul.supabase.co/functions/v1/nhl-feed?kind=clubstats&team='+code),{headers:{apikey:'sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G'}})).json().catch(()=>null);
  const goalieSample=stats?.goalies?.[0];
  report.push({code,missing:gaps,newsEmpty,values,goalieSample});
  console.log(code+' diagnostic goalie: '+JSON.stringify(goalieSample??null)+'; news: '+values[7].slice(0,180));
  console.log(code+' '+(11-gaps.length)+'/11 panels; gaps: '+gaps.join(','));
 }
 fs.writeFileSync('fan-arena-live-report.json',JSON.stringify({timestamp:new Date().toISOString(),requests,report},null,2));
 if(report.every(r=>r.missing.length===11))throw Error('All panels unavailable');
})().catch(e=>{console.error(e);process.exitCode=1});
