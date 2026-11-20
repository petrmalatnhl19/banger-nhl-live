'use strict';
// LINEUPS-03.12: five-player overlap restricted to simultaneous-five windows.
// Candidate-only: no independent verification of game strength.
function candidateFiveUnits(shifts,windows,teamIds){
 const base={status:'unverified',teams:[],verifiedUnits:false};
 if(!Array.isArray(shifts)||!Array.isArray(windows)||!Array.isArray(teamIds)||teamIds.length!==2||new Set(teamIds).size!==2||!teamIds.every(Number.isInteger))return base;
 const events=new Map(),active=new Map(teamIds.map(id=>[id,new Map()]));let lastEnd=0;
 for(const w of windows){
  if(!Number.isInteger(w.start)||!Number.isInteger(w.end)||w.start<lastEnd||w.end<=w.start||w.end>3600)return base;
  lastEnd=w.end;
 }
 for(const s of shifts){
  if(!teamIds.includes(s?.teamId))continue;
  if(!Number.isInteger(s.playerId)||!Number.isInteger(s.start)||!Number.isInteger(s.end)||s.start<0||s.end>3600||s.end<=s.start)return base;
  for(const [t,d] of [[s.start,1],[s.end,-1]]){if(!events.has(t))events.set(t,[]);events.get(t).push({teamId:s.teamId,id:s.playerId,d})}
 }
 const times=[...new Set([0,3600,...events.keys(),...windows.flatMap(w=>[w.start,w.end])])].sort((a,b)=>a-b);
 const totals=new Map(teamIds.map(id=>[id,new Map()]));let windowIndex=0,covered=0;
 for(let i=0;i<times.length-1;i++){
  const t=times[i],end=times[i+1];
  for(const e of events.get(t)||[]){const a=active.get(e.teamId),n=(a.get(e.id)||0)+e.d;if(n<0)return base;if(n===0)a.delete(e.id);else a.set(e.id,n)}
  while(windowIndex<windows.length&&windows[windowIndex].end<=t)windowIndex++;
  const w=windows[windowIndex];if(!w||t<w.start||end>w.end)continue;
  if(!teamIds.every(id=>active.get(id).size===5&&[...active.get(id).values()].every(n=>n===1)))return base;
  covered+=end-t;
  for(const teamId of teamIds){const ids=[...active.get(teamId).keys()].sort((a,b)=>a-b),key=ids.join(','),m=totals.get(teamId);m.set(key,(m.get(key)||0)+end-t)}
 }
 const teams=teamIds.map(teamId=>({teamId,seconds:covered,units:[...totals.get(teamId)].map(([key,seconds])=>({playerIds:key.split(',').map(Number),seconds})).sort((a,b)=>b.seconds-a.seconds||a.playerIds.join(',').localeCompare(b.playerIds.join(',')))}));
 return {status:'candidate-only',teams,verifiedUnits:false};
}
module.exports={candidateFiveUnits};
