'use strict';
// LINEUPS-03: offline-only overlap calculation. No inferred PP/PK without
// explicit, trusted strength windows. Intervals use half-open seconds [start,end).
function normalizeShifts(shifts) {
  if (!Array.isArray(shifts)) return [];
  return shifts.filter(s => s && Number.isInteger(s.playerId) && Number.isInteger(s.teamId)
    && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start
    && s.end <= 3900 && s.end - s.start <= 180)
    .map(s => ({playerId:s.playerId,teamId:s.teamId,start:s.start,end:s.end}));
}
function observedUnits({shifts, windows, teamId, minSeconds=15}) {
  if (!Number.isInteger(teamId) || !Array.isArray(windows)) return [];
  const entries=normalizeShifts(shifts).filter(s=>s.teamId===teamId);
  const durations=new Map();
  for(const w of windows) {
    if (!w || !['PP','PK','EV'].includes(w.kind) || !Number.isFinite(w.start)
      || !Number.isFinite(w.end) || w.start<0 || w.end<=w.start
      || !Number.isInteger(w.teamSkaters) || !Number.isInteger(w.opponentSkaters)) continue;
    const expected=w.kind==='PP' ? w.teamSkaters>w.opponentSkaters
      : w.kind==='PK' ? w.teamSkaters<w.opponentSkaters
      : w.teamSkaters===5 && w.opponentSkaters===5;
    if(!expected) continue;
    const relevant=entries.filter(s=>s.start<w.end && s.end>w.start);
    const edges=[w.start,w.end,...relevant.flatMap(s=>[Math.max(w.start,s.start),Math.min(w.end,s.end)])].sort((a,b)=>a-b);
    for(let i=1;i<edges.length;i++){
      const a=edges[i-1],b=edges[i];if(b<=a)continue;
      const onIce=[...new Set(relevant.filter(s=>s.start<=a&&s.end>=b).map(s=>s.playerId))].sort((x,y)=>x-y);
      // Require exact skater count; goalie shifts must not be passed in.
      if(onIce.length!==w.teamSkaters)continue;
      const key=w.kind+':'+onIce.join(',');
      durations.set(key,(durations.get(key)||0)+(b-a));
    }
  }
  return [...durations].filter(([,seconds])=>seconds>=minSeconds)
    .map(([key,seconds])=>({kind:key.split(':')[0],playerIds:key.split(':')[1].split(',').map(Number),seconds}))
    .sort((a,b)=>b.seconds-a.seconds);
}
module.exports={normalizeShifts,observedUnits};
