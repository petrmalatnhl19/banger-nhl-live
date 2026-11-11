"use strict";
/* Fail-closed assembly from pre-existing timestamped source snapshots. No writes/network. */
const validTime=x=>typeof x==="string"&&Number.isFinite(Date.parse(x));
const numeric=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=20;
function assemblePregameSourceInput({gameId,awayTeam,homeTeam,asOf,now,schedules=[],predictions=[],observations=[],identities=[],gsaxSnapshots=[]}={}){
 const fail=reason=>({ready:false,reason,production:false,persistable:false});
 if(!gameId||!/^[A-Z]{3}$/.test(awayTeam||"")||!/^[A-Z]{3}$/.test(homeTeam||"")||awayTeam===homeTeam||!validTime(asOf)||!validTime(now)||Date.parse(asOf)>Date.parse(now)||Date.parse(now)-Date.parse(asOf)>300000)return fail("invalid_live_context");
 const scoped=schedules.filter(s=>String(s.game_id)===String(gameId)&&s.away_team===awayTeam&&s.home_team===homeTeam&&validTime(s.fetched_at)&&Date.parse(s.fetched_at)<=Date.parse(asOf)&&validTime(s.kickoff_at)&&Date.parse(s.kickoff_at)>Date.parse(now));
 if(!scoped.length)return fail("missing_pregame_schedule");
 const kickoffTimes=new Set(scoped.map(s=>s.kickoff_at));
 if(kickoffTimes.size!==1)return fail("conflicting_schedule_kickoff");
 const kickoffAt=scoped[0].kickoff_at;
 const archive=predictions.filter(p=>String(p.game_id)===String(gameId)&&p.away_team===awayTeam&&p.home_team===homeTeam);
 if(archive.length!==1)return fail(archive.length?"ambiguous_baseline_archive":"missing_baseline_archive");
 const p=archive[0];
 // CORE 4.2 is the reference; no post-hoc baseline recomputation.
 if(!validTime(p.core42_predicted_at)||Date.parse(p.core42_predicted_at)>Date.parse(asOf)||Date.parse(p.core42_predicted_at)>=Date.parse(kickoffAt)||!numeric(p.core42_away)||!numeric(p.core42_home))return fail("invalid_core42_baseline");
 const snapshots=gsaxSnapshots.filter(s=>validTime(s.fetchedAt)&&Date.parse(s.fetchedAt)<=Date.parse(asOf)&&Array.isArray(s.rows));
 if(!snapshots.length)return fail("missing_archived_pregame_gsax");
 snapshots.sort((a,b)=>Date.parse(b.fetchedAt)-Date.parse(a.fetchedAt));
 if(snapshots.length>1&&snapshots[0].fetchedAt===snapshots[1].fetchedAt)return fail("ambiguous_gsax_snapshot");
 const latest=snapshots[0];
 if(!latest.archiveId||typeof latest.archiveId!=="string")return fail("missing_gsax_archive_provenance");
 const payload={gameId,awayTeam,homeTeam,predictionAt:asOf,kickoffAt,
  baseline:{away:p.core42_away,home:p.core42_home,predictedAt:p.core42_predicted_at},
  observations:observations.filter(o=>String(o.game_id)===String(gameId)&&[awayTeam,homeTeam].includes(o.team_code)),
  identities,gsaxRows:latest.rows,gsaxFetchedAt:latest.fetchedAt};
 return {ready:true,payload,provenance:{gsaxArchiveId:latest.archiveId,scheduleFetchedAt:scoped.map(s=>s.fetched_at).sort().at(-1),baselineModel:"core42"},production:false,persistable:false};
}
module.exports={assemblePregameSourceInput};
