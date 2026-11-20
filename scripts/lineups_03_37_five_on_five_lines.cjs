'use strict';
// LINEUPS-03.37: reconstruct 5v5 forward trios and defence pairs from actual shift overlaps.
// Candidate intervals and NHL roster positions are required. No publication or verification.
function extractFiveOnFiveLines({shifts,intervals,boxscore}={}){
 const fail=reason=>({status:'unverified',reason,teams:[],publishable:false,verifiedUnits:false});
 if(!Array.isArray(shifts)||!Array.isArray(intervals)||!boxscore?.playerByGameStats)return fail('missing-evidence');
 const teams=[],roles=new Map();
 for(const side of ['awayTeam','homeTeam']){
  const id=boxscore[side]?.id,roster=boxscore.playerByGameStats[side];
  if(!Number.isInteger(id)||!Array.isArray(roster?.forwards)||!Array.isArray(roster?.defense)||!Array.isArray(roster?.goalies))return fail('incomplete-roster');
  const map=new Map();
  for(const [group,items] of [['forward',roster.forwards],['defence',roster.defense]]){
   for(const player of items){if(!Number.isInteger(player.playerId)||map.has(player.playerId))return fail('invalid-roster');
    const name=(player.name?.default||[player.firstName?.default,player.lastName?.default].filter(Boolean).join(' ')).trim();
    if(!name)return fail('missing-name');
    map.set(player.playerId,{name,group});
   }
  }
  if(!map.size||!roster.goalies.length)return fail('incomplete-roster');
  roles.set(id,map);teams.push({teamId:id,forwardTrioSeconds:new Map(),defencePairSeconds:new Map(),candidateSeconds:0});
 }
 if(roles.size!==2)return fail('duplicate-team');
 const seen=new Set();
 for(const s of shifts){
  if(!s||!roles.has(s.teamId)||!Number.isInteger(s.playerId)||!roles.get(s.teamId).has(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start)return fail('invalid-shift');
  const key=[s.teamId,s.playerId,s.start,s.end].join(':');if(seen.has(key))return fail('duplicate-shift');seen.add(key);
 }
 let prev=0;
 for(const w of intervals){
  if(!w||w.strength!=='5v5'||!Number.isInteger(w.startSecond)||!Number.isInteger(w.endSecondExclusive)||w.startSecond<prev||w.endSecondExclusive>3600||w.endSecondExclusive<=w.startSecond)return fail('invalid-5v5-window');
  prev=w.endSecondExclusive;
  for(let t=w.startSecond;t<w.endSecondExclusive;t++){
   const activeByTeam=teams.map(team=>shifts.filter(s=>s.teamId===team.teamId&&s.start<=t&&t<s.end));
   if(activeByTeam.some(a=>a.length!==5||new Set(a.map(s=>s.playerId)).size!==5))return fail('incomplete-on-ice');
   for(let i=0;i<teams.length;i++){
    const team=teams[i],active=activeByTeam[i],map=roles.get(team.teamId);
    const f=active.filter(s=>map.get(s.playerId).group==='forward').map(s=>s.playerId).sort((a,b)=>a-b);
    const d=active.filter(s=>map.get(s.playerId).group==='defence').map(s=>s.playerId).sort((a,b)=>a-b);
    if(f.length!==3||d.length!==2)return fail('nonstandard-position-composition');
    for(const [bucket,ids] of [[team.forwardTrioSeconds,f],[team.defencePairSeconds,d]]){
     const key=ids.join(',');bucket.set(key,(bucket.get(key)||0)+1);
    }
    team.candidateSeconds++;
   }
  }
 }
 const mapped=teams.map(team=>{
  const map=roles.get(team.teamId);
  const list=bucket=>[...bucket].map(([key,seconds])=>({playerIds:key.split(',').map(Number),players:key.split(',').map(id=>map.get(Number(id)).name),seconds})).sort((a,b)=>b.seconds-a.seconds||a.playerIds.join(',').localeCompare(b.playerIds.join(',')));
  return {teamId:team.teamId,candidateSeconds:team.candidateSeconds,forwardTrios:list(team.forwardTrioSeconds),defencePairs:list(team.defencePairSeconds)};
 });
 return {status:'candidate-only',teams:mapped,publishable:false,verifiedUnits:false,reason:'Only candidate 5v5 intervals are covered; incomplete full-game evidence and independent agreement remain unverified.'};
}
module.exports={extractFiveOnFiveLines};
