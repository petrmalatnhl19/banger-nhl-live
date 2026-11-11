"use strict";
/* Adapt independently archived Supabase goalie snapshots; no network or writes. */
const valid=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const n=x=>typeof x==="number"&&Number.isFinite(x)?x:typeof x==="string"&&x.trim()!==""&&Number.isFinite(Number(x))?Number(x):NaN;
function adaptArchivedGsaxSnapshots(rows=[],{asOf}={}){
 if(!valid(asOf))return {ready:false,reason:"invalid_asof",snapshots:[]};
 const eligible=rows.filter(r=>r&&/^\d+$/.test(String(r.goalie_id??""))&&/^[A-Z]{3}$/.test(r.team_code||"")&&r.situation==="all"&&valid(r.fetched_at)&&valid(r.created_at)&&Date.parse(r.fetched_at)<=Date.parse(asOf)&&Date.parse(r.created_at)<=Date.parse(asOf)&&/^[a-f0-9]{64}$/i.test(r.source_sha256||"")&&[r.x_goals_against,r.goals_against,r.shots_against].every(x=>Number.isFinite(n(x))&&n(x)>=0));
 const groups=new Map();
 for(const r of eligible){const key=r.fetched_at+"|"+r.source_sha256;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
 const snapshots=[];
 for(const [key,group] of groups){
  const seen=new Set();let duplicate=false;
  for(const r of group){const k=r.goalie_id+"|"+r.team_code;if(seen.has(k))duplicate=true;seen.add(k);}
  if(duplicate)continue;
  const first=group[0];
  snapshots.push({archiveId:"supabase-goalie-snapshot:"+first.source_sha256+":"+first.fetched_at,
   fetchedAt:first.fetched_at,rows:group.map(r=>({playerId:String(r.goalie_id),team:r.team_code,situation:"all",xGoals:n(r.x_goals_against),goals:n(r.goals_against),ongoal:n(r.shots_against)}))});
 }
 snapshots.sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt));
 return {ready:snapshots.length>0,reason:snapshots.length?null:"no_verified_archived_gsax_snapshot",snapshots,excludedRows:rows.length-eligible.length,production:false,persistable:false};
}
module.exports={adaptArchivedGsaxSnapshots};
