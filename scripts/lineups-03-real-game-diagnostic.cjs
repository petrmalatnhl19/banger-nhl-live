'use strict';
// LINEUPS-03 real-game read-only diagnostic. No production writes or secrets.
// Usage: node scripts/lineups-03-real-game-diagnostic.cjs [gameId]
const https=require('node:https');
const {parseShiftCharts}=require('./lineups_shiftcharts_adapter.cjs');
const {classifyShiftRows}=require('./lineups_shiftcharts_rejection_audit.cjs');
const {verifyLongShiftRoles}=require('./lineups_game_roster_audit.cjs');
const {extractRosterSkaterShifts}=require('./lineups_roster_skater_shifts.cjs');
const {summarizeSkaterOccupancy}=require('./lineups_skater_occupancy_audit.cjs');
const {observedFiveSkaterCombinations}=require('./lineups_five_skater_combinations.cjs');
const {simultaneousFiveSkaterWindows}=require('./lineups_simultaneous_five_audit.cjs');
const {candidateFiveUnits}=require('./lineups_candidate_five_units.cjs');
const {annotateCandidateUnits}=require('./lineups_candidate_names.cjs');
const {auditSituationEvidence}=require('./lineups_situation_evidence_audit.cjs');
const {auditEventStrengthAgreement}=require('./lineups_event_strength_agreement.cjs');
const {auditStrengthBoundaryMismatches}=require('./lineups_strength_boundary_audit.cjs');
const {classifyStrengthMismatchEvents}=require('./lineups_strength_mismatch_types.cjs');
const {auditBoundaryAlternatives}=require('./lineups_boundary_alternatives.cjs');
const {eventStrengthEvidence}=require('./lineups_event_strength_evidence.cjs');
const {candidateStrengthIntervals}=require('./lineups_candidate_strength_intervals.cjs');
const {candidateStrengthUnits}=require('./lineups_candidate_strength_units.cjs');
const {annotateStrengthUnits}=require('./lineups_candidate_strength_names.cjs');
const {summarizeSpecialTeamsCandidates}=require('./lineups_special_teams_candidate_summary.cjs');
const {auditCandidateCoverage}=require('./lineups_candidate_coverage_audit.cjs');
const gameId=process.argv[2]||'2026020335';
if(!/^\d{10}$/.test(gameId)){console.error('Invalid game ID');process.exitCode=2;}
else {
 const url='https://api.nhle.com/stats/rest/en/shiftcharts?cayenneExp='+encodeURIComponent('gameId='+gameId);
 const fetchJson=url=>new Promise((resolve,reject)=>{
   const req=https.get(url,{headers:{Accept:'application/json','User-Agent':'BangerNHL-Lineups03-readonly/1.0'},timeout:12000},res=>{
     if(res.statusCode!==200){res.resume();reject(Error('HTTP '+res.statusCode));return}
     let raw='';res.setEncoding('utf8');res.on('data',chunk=>{raw+=chunk;if(raw.length>8_000_000)req.destroy(Error('Oversized response'))});
     res.on('end',()=>{try{resolve(JSON.parse(raw))}catch(e){reject(Error('Invalid JSON'))}});
   });req.on('timeout',()=>req.destroy(Error('Timeout')));req.on('error',reject);
 });
 Promise.all([fetchJson(url),fetchJson('https://api-web.nhle.com/v1/gamecenter/'+gameId+'/boxscore').catch(e=>({fetchError:e.message})),fetchJson('https://api-web.nhle.com/v1/gamecenter/'+gameId+'/play-by-play').catch(e=>({fetchError:e.message}))]).then(([payload,boxscore,playByPlay])=>{
   const parsed=parseShiftCharts(payload,gameId);
   const rejectionAudit=classifyShiftRows(payload,gameId);
   const roleAudit=boxscore.fetchError?{status:'unverified',reason:'boxscore-fetch-failed'}:verifyLongShiftRoles(payload,boxscore,gameId);
   const skaterAudit=boxscore.fetchError?{status:'unverified',reason:'boxscore-fetch-failed'}:extractRosterSkaterShifts(payload,boxscore,gameId);
   const occupancyAudit=skaterAudit.shifts?.length&&boxscore.awayTeam&&boxscore.homeTeam?summarizeSkaterOccupancy(skaterAudit.shifts,[boxscore.awayTeam.id,boxscore.homeTeam.id]):{status:'unverified'};
   const fiveSkaterAudit=skaterAudit.shifts?.length&&boxscore.awayTeam&&boxscore.homeTeam?observedFiveSkaterCombinations(skaterAudit.shifts,[boxscore.awayTeam.id,boxscore.homeTeam.id]):{status:'unverified'};
   const fiveSkaterSummary={status:fiveSkaterAudit.status,verifiedUnits:false,teams:(fiveSkaterAudit.teams||[]).map(t=>({teamId:t.teamId,fiveSkaterSeconds:t.fiveSkaterSeconds,rejected:t.rejected,combinationCount:t.combinations.length,topFive:t.combinations.slice(0,5)}))};
   const simultaneousFiveAudit=skaterAudit.shifts?.length&&boxscore.awayTeam&&boxscore.homeTeam?simultaneousFiveSkaterWindows(skaterAudit.shifts,[boxscore.awayTeam.id,boxscore.homeTeam.id]):{status:'unverified'};
   const simultaneousFiveSummary={status:simultaneousFiveAudit.status,seconds:simultaneousFiveAudit.seconds??0,windowCount:simultaneousFiveAudit.windows?.length??0,verifiedStrength:false};
   const fiveUnitsAudit=simultaneousFiveAudit.status==='candidate-only'?candidateFiveUnits(skaterAudit.shifts,simultaneousFiveAudit.windows,[boxscore.awayTeam.id,boxscore.homeTeam.id]):{status:'unverified',teams:[]};
   const fiveUnitsSummary={status:fiveUnitsAudit.status,verifiedUnits:false,teams:(fiveUnitsAudit.teams||[]).map(t=>({teamId:t.teamId,seconds:t.seconds,unitCount:t.units.length,topFive:t.units.slice(0,5)}))};
   const namedFiveUnits=annotateCandidateUnits(fiveUnitsAudit,boxscore);
   const namedFiveSummary={status:namedFiveUnits.status,verifiedUnits:false,teams:namedFiveUnits.teams};
   const situationEvidence=playByPlay.fetchError?{status:'unverified',reason:'play-by-play-fetch-failed',verifiedStrengthWindows:false}:auditSituationEvidence(playByPlay,gameId);
   const eventStrengthAgreement=skaterAudit.shifts?.length&&Array.isArray(playByPlay.plays)&&boxscore.awayTeam&&boxscore.homeTeam?auditEventStrengthAgreement(playByPlay.plays,skaterAudit.shifts,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',verifiedStrengthWindows:false};
   const strengthBoundaryAudit=skaterAudit.shifts?.length&&Array.isArray(playByPlay.plays)&&boxscore.awayTeam&&boxscore.homeTeam?auditStrengthBoundaryMismatches(playByPlay.plays,skaterAudit.shifts,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',verifiedStrengthWindows:false};
   const strengthMismatchTypes=classifyStrengthMismatchEvents(strengthBoundaryAudit);
   const boundaryAlternatives=skaterAudit.shifts?.length&&Array.isArray(playByPlay.plays)&&boxscore.awayTeam&&boxscore.homeTeam?auditBoundaryAlternatives(playByPlay.plays,skaterAudit.shifts,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',verifiedStrengthWindows:false};
   const strengthEvidence=skaterAudit.shifts?.length&&Array.isArray(playByPlay.plays)&&boxscore.awayTeam&&boxscore.homeTeam?eventStrengthEvidence(playByPlay.plays,skaterAudit.shifts,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',verifiedStrengthWindows:false,verifiedUnits:false};
   const strengthIntervalCandidates=skaterAudit.shifts?.length&&Array.isArray(playByPlay.plays)&&boxscore.awayTeam&&boxscore.homeTeam?candidateStrengthIntervals(playByPlay.plays,skaterAudit.shifts,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',verifiedStrengthWindows:false,verifiedUnits:false};
   const strengthIntervalSummary={status:strengthIntervalCandidates.status,candidateCount:strengthIntervalCandidates.candidates?.length??0,totalSeconds:strengthIntervalCandidates.totalSeconds??0,byStrength:Object.fromEntries([...new Set((strengthIntervalCandidates.candidates??[]).map(x=>x.strength))].map(k=>[k,{count:strengthIntervalCandidates.candidates.filter(x=>x.strength===k).length,seconds:strengthIntervalCandidates.candidates.filter(x=>x.strength===k).reduce((n,x)=>n+x.seconds,0)}])),verifiedStrengthWindows:false,verifiedUnits:false};
   const strengthUnits= strengthIntervalCandidates.status==='candidate-only'?candidateStrengthUnits(skaterAudit.shifts,strengthIntervalCandidates.candidates,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',teams:[],verifiedUnits:false};
   const strengthUnitsSummary={status:strengthUnits.status,verifiedUnits:false,teams:(strengthUnits.teams||[]).map(t=>({teamId:t.teamId,seconds:t.seconds,unitCount:t.units.length,byStrength:Object.fromEntries([...new Set(t.units.map(u=>u.strength))].map(k=>[k,{unitCount:t.units.filter(u=>u.strength===k).length,topThree:t.units.filter(u=>u.strength===k).slice(0,3)}]))}))};
   const namedStrengthUnits=annotateStrengthUnits(strengthUnits,boxscore);
   const namedStrengthSummary={status:namedStrengthUnits.status,verifiedUnits:false,teams:(namedStrengthUnits.teams||[]).map(t=>({teamId:t.teamId,byStrength:Object.fromEntries([...new Set(t.units.map(u=>u.strength))].map(k=>[k,t.units.filter(u=>u.strength===k).slice(0,3)]))}))};
   const specialTeamsCandidates=boxscore.awayTeam&&boxscore.homeTeam?summarizeSpecialTeamsCandidates(namedStrengthUnits,boxscore.awayTeam.id,boxscore.homeTeam.id):{status:'unverified',teams:[],publishable:false,verifiedUnits:false};
   const specialTeamsSummary={status:specialTeamsCandidates.status,publishable:false,verifiedUnits:false,teams:(specialTeamsCandidates.teams||[]).map(t=>({teamId:t.teamId,PP:t.PP.slice(0,3),PK:t.PK.slice(0,3),ppCandidateCount:t.PP.length,pkCandidateCount:t.PK.length}))};
   const candidateCoverage=auditCandidateCoverage(strengthIntervalCandidates.candidates,strengthUnits,boxscore.awayTeam?.id,boxscore.homeTeam?.id);
   const boxscoreShape=boxscore.fetchError?{fetchStatus:'failed'}:{fetchStatus:'ok',topLevelKeys:Object.keys(boxscore).sort(),playerByGameKeys:Object.keys(boxscore.playerByGameStats||{}).sort(),playerByGameTypes:Object.fromEntries(Object.entries(boxscore.playerByGameStats||{}).map(([key,value])=>[key,Array.isArray(value)?'array':typeof value]))};
   const data=Array.isArray(payload.data)?payload.data:[];
   const periods=[...new Set(data.map(x=>x.period))].sort();
   const teams=[...new Set(data.map(x=>x.teamId))].sort();
   const players=new Set(data.map(x=>x.playerId));
   const result={gameId,endpoint:'NHL Stats shiftcharts',http:'200',reportedTotal:payload.total??null,rawRows:data.length,teams,players:players.size,periods,
     accepted:parsed.shifts.length,rejected:parsed.rejected,rejectionReasons:rejectionAudit.reasons,normalizationDetails:rejectionAudit.normalizationDetails,longShiftSummary:rejectionAudit.longShiftSummary,longShiftRoleAudit:roleAudit,skaterShiftAudit:{status:skaterAudit.status,skaterShiftCount:skaterAudit.skaterShiftCount??0,goalieShiftCount:skaterAudit.goalieShiftCount??0,rejected:skaterAudit.rejected??0,verifiedUnits:false},occupancyAudit,fiveSkaterSummary,simultaneousFiveSummary,fiveUnitsSummary,namedFiveSummary,situationEvidence,eventStrengthAgreement,strengthBoundaryAudit,strengthMismatchTypes,boundaryAlternatives,strengthEvidence,strengthIntervalSummary,strengthUnitsSummary,namedStrengthSummary,specialTeamsSummary,candidateCoverage,boxscoreShape,classificationMatchesParser:rejectionAudit.accepted===parsed.shifts.length&&rejectionAudit.rejected===parsed.rejected,status:parsed.status,
     verifiedUnits:false,reason:'No verified strength windows or roster/goalie completeness; this diagnostic does not publish PP/PK units.'};
   console.log(JSON.stringify(result,null,2));
   if(parsed.status!=='partial'||!parsed.shifts.length)process.exitCode=3;
 }).catch(e=>{console.error(JSON.stringify({gameId,status:'fetch-failed',error:e.message,verifiedUnits:false}));process.exitCode=4});
}
