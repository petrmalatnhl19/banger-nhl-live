"use strict";
// Read-only NHL right-rail schema diagnostic. No secrets or writes.
(async()=>{
 const id="2026020335";
 const res=await fetch("https://api-web.nhle.com/v1/gamecenter/"+id+"/right-rail",{signal:AbortSignal.timeout(15000)});
 console.log("right-rail HTTP:",res.status);
 if(!res.ok)throw Error("NHL upstream HTTP "+res.status);
 const data=await res.json();
 const keys=v=>v&&typeof v==="object"?Object.keys(v):[];
 const sample=rows=>Array.isArray(rows)?rows.slice(0,25).map(x=>({category:x.category,name:x.name,awayValue:x.awayValue,homeValue:x.homeValue,awayTeam:x.awayTeam,homeTeam:x.homeTeam,keys:keys(x)})):null;
 console.log("root keys:",JSON.stringify(keys(data)));
 console.log("team identity:",JSON.stringify({away:data.awayTeam?.abbrev,home:data.homeTeam?.abbrev}));
 console.log("teamGameStats:",JSON.stringify(sample(data.teamGameStats)));
 console.log("summary keys:",JSON.stringify(keys(data.summary)));
 console.log("summary.teamGameStats:",JSON.stringify(sample(data.summary?.teamGameStats)));
 const proxy="https://xxwqeiuyislnoxsmjuul.supabase.co/functions/v1/nhl-feed";
 const headers={apikey:"sb_publishable_SfeHMIvUkYTuD3jCrWub8w_fPIY0B-G"};
 const viaProxy=await fetch(proxy+"?kind=right-rail&id="+id,{headers,signal:AbortSignal.timeout(15000)});
 console.log("deployed right-rail proxy HTTP:",viaProxy.status);
 if(!viaProxy.ok)throw Error("Deployed right-rail proxy HTTP "+viaProxy.status);
 const proxied=await viaProxy.json();
 const pp=proxied.teamGameStats?.find(x=>x.category==="powerPlay");
 if(!pp||pp.awayValue!=="2/4"||pp.homeValue!=="0/2")throw Error("Deployed right-rail PP data mismatch");
 console.log("deployed right-rail PP verified:",JSON.stringify({away:pp.awayValue,home:pp.homeValue}));
 const invalid=await fetch(proxy+"?kind=right-rail&id=invalid",{headers,signal:AbortSignal.timeout(15000)});
 console.log("deployed invalid right-rail ID HTTP:",invalid.status);
 if(invalid.ok)throw Error("Invalid game ID unexpectedly accepted");
})().catch(e=>{console.error("right-rail diagnostic failed:",e.message);process.exitCode=1});
