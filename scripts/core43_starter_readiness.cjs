"use strict";
/* Read-only CORE 4.3 evidence classifier. Never upgrades a projected starter to confirmed. */
const validTime = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const norm = value => typeof value === "string" ? value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "") : "";
function classifyStarter({gameId,teamCode,goalieName,goalieId,predictionAt,observations=[],evidence=[]} = {}) {
 const unavailable = reason => ({status:"unavailable",reason,production:false,persistable:false});
 if (!validTime(predictionAt) || !gameId || !teamCode || !goalieName || !goalieId)
  return unavailable("invalid_frozen_identity_or_time");
 const asOf = Date.parse(predictionAt);
 const verified = evidence.filter(x => String(x.game_id) === String(gameId) && x.team_code === teamCode &&
   String(x.goalie_id) === String(goalieId) && validTime(x.source_published_at) &&
   validTime(x.verified_at) && Date.parse(x.source_published_at) <= asOf &&
   Date.parse(x.verified_at) <= asOf && x.evidence_status === "confirmed" &&
   typeof x.source_url === "string" && x.source_url.startsWith("https://"));
 if (verified.length) return {status:"ready_confirmed",reason:"verified_pregame_evidence",production:false,persistable:false};
 const candidates = observations.filter(x => String(x.game_id) === String(gameId) && x.team_code === teamCode &&
   validTime(x.observed_at) && validTime(x.source_snapshot_at) &&
   Date.parse(x.observed_at) <= asOf && Date.parse(x.source_snapshot_at) <= asOf);
 candidates.sort((a,b) => Date.parse(b.observed_at)-Date.parse(a.observed_at));
 if (!candidates.length) return unavailable("missing_pregame_observation");
 const latest = candidates[0];
 if (candidates.some(x => x.observed_at === latest.observed_at &&
   (norm(x.goalie_name) !== norm(latest.goalie_name) || x.observed_status !== latest.observed_status)))
  return unavailable("conflicting_latest_observations");
 if (norm(latest.goalie_name) !== norm(goalieName)) return unavailable("goalie_identity_mismatch");
 if (latest.observed_status !== "projected" && latest.observed_status !== "confirmed")
  return unavailable("unknown_starter_status");
 return {status:"ready_projected",reason:latest.observed_status === "confirmed" ?
   "observed_confirmed_without_publication_evidence" : "pregame_projection",
   observedAt:latest.observed_at,production:false,persistable:false};
}
module.exports = {classifyStarter};
