"use strict";
/* Read-only goalie source diagnostics. Never promotes projections to confirmations. */
const {validateFrozenEvidence}=require("../core43-starter-gate.js");
function diagnoseGoalie({game,asOf,evidence=[],projections=[]}={}){
 const fail=reason=>({status:"unknown",reason,goalieId:null,source:null});
 if(!game||!Number.isFinite(Date.parse(asOf))||!Number.isFinite(Date.parse(game.kickoffUTC))||Date.parse(asOf)>Date.parse(game.kickoffUTC))return fail("invalid_context");
 if(![game.awayTeam,game.homeTeam].includes(game.teamCode))return fail("invalid_team");
 const scoped=evidence.filter(e=>e&&e.gameId===game.gameId&&e.teamCode===game.teamCode);
 const accepted=scoped.map(e=>({e,v:validateFrozenEvidence(e,game,asOf)})).filter(x=>x.v.accepted);
 const ids=[...new Set(accepted.map(x=>x.v.goalieId))];
 if(ids.length>1)return {status:"conflict",reason:"conflicting_verified_starters",goalieId:null,source:null};
 if(ids.length===1)return {status:"confirmed",reason:"verified_asof",goalieId:ids[0],source:accepted[0].v.sourceName};
 const candidates=projections.filter(p=>p&&p.gameId===game.gameId&&p.teamCode===game.teamCode&&Number.isFinite(Date.parse(p.observedAt))&&Date.parse(p.observedAt)<=Date.parse(asOf)&&/^\d+$/.test(String(p.goalieId||"")));
 const projectedIds=[...new Set(candidates.map(p=>String(p.goalieId)))];
 if(projectedIds.length>1)return {status:"conflict",reason:"conflicting_projections",goalieId:null,source:null};
 if(projectedIds.length===1)return {status:"projected",reason:"projection_only",goalieId:projectedIds[0],source:candidates[0].sourceName||null};
 return fail(scoped.length?"unverified_or_late_evidence":"no_source_data");
}
module.exports={diagnoseGoalie};
