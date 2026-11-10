"use strict";
const FEED_URL="https://raw.githubusercontent.com/petrmalatnhl19/banger-nhl-live/main/rotowire_goalies.json";
function assessFeed(feed,{now=Date.now(),maxAgeMinutes=120}={}){
 const updated=Date.parse(String(feed?.updatedAt||""));
 if(!Number.isFinite(updated))return {status:"invalid_timestamp",updatedAt:feed?.updatedAt||null,ageMinutes:null,gameCount:null};
 const age=Math.round((now-updated)/60000);
 const games=Array.isArray(feed.games)?feed.games:[];
 return {status:age<0?"future_timestamp":age>maxAgeMinutes?"stale":"fresh",
  updatedAt:feed.updatedAt,ageMinutes:age,maxAgeMinutes,gameCount:games.length,
  confirmedCount:games.filter(g=>g.status==="confirmed").length,
  projectedCount:games.filter(g=>g.status==="projected").length};
}
async function run({fetchImpl=fetch,now=Date.now()}={}){
 const response=await fetchImpl(FEED_URL,{headers:{"cache-control":"no-cache"},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error("Goalie feed HTTP "+response.status);
 const feed=await response.json();
 return {mode:"read_only_shadow",source:FEED_URL,checkedAt:new Date(now).toISOString(),
  ...assessFeed(feed,{now}),production:false,persistable:false};
}
if(require.main===module)run().then(r=>{console.log(JSON.stringify(r,null,2));
 if(r.status!=="fresh")console.error("WARNING: goalie feed is "+r.status+"; upstream collector needs investigation");
}).catch(e=>{console.error("WARNING: goalie feed unavailable: "+e.message);
 console.log(JSON.stringify({mode:"read_only_shadow",status:"unavailable",error:e.message,production:false,persistable:false}));
});
module.exports={assessFeed,run};
