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
})().catch(e=>{console.error("right-rail diagnostic failed:",e.message);process.exitCode=1});
