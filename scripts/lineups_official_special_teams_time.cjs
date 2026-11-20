'use strict';
// LINEUPS-03.26: conservative extraction of official NHL team power-play time.
// No inference from penalty minutes, PP opportunities, or player TOI.
// Missing official PP time is explicitly unknown, not zero.
function parseTime(value){
 if(typeof value!=='string'||!/^\d{1,3}:\d{2}$/.test(value))return null;
 const [m,s]=value.split(':').map(Number);return s<60?m*60+s:null;
}
function officialSpecialTeamsTime(landing,awayId,homeId){
 const fail={status:'unverified',teams:[],verifiedTotalTime:false,reason:'No supported official team PP time fields'};
 if(!landing||!Number.isInteger(awayId)||!Number.isInteger(homeId)||awayId===homeId)return fail;
 const stats=landing.summary?.teamGameStats;
 if(!Array.isArray(stats))return fail;
 // NHL landing teamGameStats rows can expose category and awayValue/homeValue.
 const row=stats.find(x=>x?.category==='powerPlayTime'||x?.category==='powerPlayTimeOnIce');
 if(!row)return fail;
 const away=parseTime(row.awayValue),home=parseTime(row.homeValue);
 if(away===null||home===null)return fail;
 return {status:'official-time',teams:[{teamId:awayId,PPSeconds:away,PKSeconds:home},{teamId:homeId,PPSeconds:home,PKSeconds:away}],verifiedTotalTime:true,source:'NHL gamecenter landing summary teamGameStats',note:'Team PP time only; does not independently verify skater combinations.'};
}
module.exports={officialSpecialTeamsTime,parseTime};
