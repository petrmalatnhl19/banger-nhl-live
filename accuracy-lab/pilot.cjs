"use strict";

const { readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { canonical, timestamp } = require("./engine.js");
const { capture, inspectCapture, fetchSource, readSource } = require("./pregame.cjs");
const { collectPlayers, inspectPlayers } = require("./players.cjs");
const { policy, required, inspectManifest, sha256 } = require("./reference.cjs");
const { replay } = require("./v26-replay.cjs");
const { prepareExport, verifyExport } = require("./external-time.cjs");
const { writeArchive } = require("./snapshot.cjs");
const { publicPin } = require("./pilot-keys.cjs");

const format = "banger-accuracy-live-capture-v1";
const archiveFormat = "banger-accuracy-live-archive-v1";
const root = "https://xxwqeiuyislnoxsmjuul.supabase.co/rest/v1/";
const collectorSha = "aad6123716126e4ab7f7934daec6aa4fd9dae446cd08038ac2d5174d3c2bd42b";
const homeSource = "urn:banger:nhl-prediction-collect:v26:sha256:" + collectorSha;
const homeFactors = { awayAdjustment: -0.015, homeAdjustment: 0.015 };
const affected = {
  xg4: ["xg4", "banger-xg-v4-5v5-attack-defense"],
  goalie32: ["goalie32", "banger-core-v3.2-goalie-shrinkage"],
  special33: ["special33", "banger-core-v3.3-specialteams-experimental"],
  form31: ["advanced", "banger-core-v3.1-form20"]
};
const goalieKey = "goalie32Factors";
const sides = ["away", "home"];
const iso = time => new Date(time).toISOString();
const same = (a, b) => canonical(a) === canonical(b);
const inRange = (value, start, end) => timestamp(value) >= start && timestamp(value) <= end;

function endpoints(gameId) {
  const query = names => new URLSearchParams({ game_id: "eq." + gameId, select: names.join(","), limit: "2" });
  const shared = ["game_id", "away_team", "home_team"];
  return {
    components: root + "nhl_prediction_archive?" + query([...shared, "game_date", "status",
      ...Object.values(affected).flatMap(([key]) => ["away", "home", "predicted_at", "version", "factors"].map(f => key + "_" + f))]),
    archivedSchedule: root + "nhl_core43_public_schedule_evidence?" + query([...shared, "kickoff_at"])
  };
}

function publicArchiveHeaders() {
  const frontend = readFileSync(join(__dirname, "..", "core-performance.js"), "utf8");
  const key = /const APIKEY='(sb_publishable_[A-Za-z0-9_-]+)'/.exec(frontend)?.[1];
  if (!key) throw Error("Public archive key is unavailable");
  return { apikey: key };
}

async function collectPilot(date, id, mode, options = {}) {
  const { fetcher = fetch, now = Date.now } = options;
  const base = await capture(date, id, mode, { fetcher, now });
  const urls = endpoints(id);
  const archive = Promise.all(Object.entries(urls).map(async ([key, url]) => {
    const data = await fetchSource(url, fetcher, now, "json", publicArchiveHeaders());
    return [key, data];
  }));
  const players = collectPlayers(date, id, mode === "capture" ? base : undefined, { fetcher, now })
    .then(bundle => ({ bundle }), () => ({ issue: "player_capture_unavailable" }));
  const [sourceEntries, playerCollection] = await Promise.all([archive, players]);
  return { schema: format, base, ...playerCollection, archive: Object.fromEntries(sourceEntries), finishedAt: iso(now()) };
}

function describeSource(key, source, reportedPublication = null) {
  return { key, url: source?.resolvedUrl ?? source?.url ?? null, status: source?.status ?? "unavailable",
    requestedAt: source?.requestedAt ?? null, retrievedAt: source?.retrievedAt ?? null,
    publishedAt: reportedPublication, version: source?.version ?? null, sha256: source?.sha256 ?? null };
}

function extractComponents(game, rows, schedules, availableAt, url) {
  const matching = row => String(row?.game_id) === game.gameId && row.away_team === game.away && row.home_team === game.home;
  const schedule = Array.isArray(schedules) && schedules.length === 1 ? schedules[0] : null;
  const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (!matching(schedule) || timestamp(schedule.kickoff_at) !== timestamp(game.scheduledAt)) {
    return { components: {}, reason: "archive_schedule_unlinked" };
  }
  if (!matching(row) || row.status !== "pending" || row.game_date !== game.scheduledAt.slice(0, 10)) {
    return { components: {}, reason: "archive_game_unavailable" };
  }
  const bound = Math.min(timestamp(availableAt), timestamp(game.referenceAt));
  const components = {};
  for (const [name, [key, version]] of Object.entries(affected)) {
    const away = row[key + "_away"], home = row[key + "_home"], at = row[key + "_predicted_at"];
    if (row[key + "_version"] === version && [away, home].every(number => Number.isFinite(number) && number >= 0.4)
      && Number.isFinite(timestamp(at)) && timestamp(at) <= bound) {
      components[name] = { away, home, predictedAt: at, availableAt, source: url };
    }
  }
  const factors = row.goalie32_factors;
  const sample = goalie => Number.isSafeInteger(goalie?.shots) && goalie.shots >= 0;
  const goalie32Factors = components.goalie32 && typeof factors?.goalie_data_missing === "boolean"
    && (factors.goalie_data_missing || (sample(factors.away_goalie) && sample(factors.home_goalie)))
    ? { payload: factors, availableAt, source: url } : undefined;
  return { components, goalie32Factors, reason: null };
}

function analyze(bundle) {
  if (bundle?.schema !== format || !Number.isFinite(timestamp(bundle.finishedAt))) throw Error("Invalid pilot capture");
  const { base } = bundle;
  const { timely, candidates } = inspectCapture(base);
  const game = base.game;
  const opens = timestamp(game.opensAt);
  const cutoff = timestamp(game.referenceAt);
  const end = timestamp(bundle.finishedAt);
  const timelySource = item => item?.status === "ok" && inRange(item.requestedAt, opens, Math.min(end, cutoff))
    && inRange(item.retrievedAt, opens, Math.min(end, cutoff));
  const accepts = item => item?.status === "ok"
    && Number.isFinite(timestamp(item.retrievedAt)) && timestamp(item.retrievedAt) <= Math.min(end, cutoff)
    && (base.mode === "probe" || timelySource(item));
  const crossCheckUrl = "https://api-web.nhle.com/v1/gamecenter/" + game.gameId + "/landing";
  const independent = bundle.officialCrossCheck;
  const league = independent ? readSource(independent, crossCheckUrl) : null;
  const independentOk = !Object.hasOwn(bundle, "officialCrossCheck") || (timelySource(independent)
    && String(league?.id) === game.gameId && league.gameDate === game.gameDate
    && league.awayTeam?.abbrev === game.away && league.homeTeam?.abbrev === game.home
    && ["FUT", "PRE"].includes(league.gameState) && timestamp(league.startTimeUTC) === timestamp(game.scheduledAt));
  const eligibleWindow = timely && end <= cutoff && end >= timestamp(base.finishedAt) && timelySource(base.sources.score);
  const observation = (payload, locator, acquired, dataThrough = acquired) => ({ source: locator,
    retrievedAt: acquired, availableAt: acquired, dataThrough, sha256: sha256(payload), payload });
  const observations = {};
  for (const [key, item] of Object.entries(candidates)) {
    const used = item.sourceNames.map(name => base.sources[name]);
    if (!used.every(accepts)) continue;
    observations[key] = observation(item.payload, used.length === 1 ? used[0].resolvedUrl : "urn:banger:nhl:rest:" + game.gameId,
      iso(Math.max(...used.map(row => timestamp(row.retrievedAt)))));
  }
  if (eligibleWindow) observations.homeAdvantage = observation(homeFactors, homeSource, base.sources.score.retrievedAt);
  const verification = { source: homeSource, version: "v26", sha256: collectorSha, retrievedAt: null,
    publishedAt: null, status: "pinned_configuration" };

  const sources = Object.entries(base.sources).map(([key, value]) => describeSource(key, value));
  if (independent) sources.push(describeSource("gamecenter", independent));
  if (bundle.bundle) {
    const playerBundle = bundle.bundle;
    const playerData = inspectPlayers(playerBundle);
    const linked = playerBundle.captureSha256 === sha256(base) && same(playerBundle.sources.score, base.sources.score)
      && playerData.game.id === game.gameId && playerData.game.scheduledAt === game.scheduledAt
      && playerData.game.teams.away.team === game.away && playerData.game.teams.home.team === game.home;
    const names = [playerData.previewKey, "awayRoster", "homeRoster"];
    sources.push(...Object.keys(playerBundle.sources).filter(name => name !== "score").map(name =>
      describeSource(name, playerBundle.sources[name], name === playerData.previewKey ? playerData.article?.publishedAt ?? null : null)));
    if (linked && playerData.timely && timestamp(playerBundle.finishedAt) <= end
      && names.every(name => accepts(playerBundle.sources[name]))) {
      const acquired = iso(Math.max(...names.map(name => timestamp(playerBundle.sources[name].retrievedAt))));
      if (!observations.goalies && playerData.goalies) {
        observations.goalies = observation(playerData.goalies, playerData.previewUrl, acquired, playerData.article.modifiedAt);
      }
      for (const key of ["lineups", "absences"]) {
        if (playerData.missing.includes(key)) continue;
        const rows = Object.fromEntries(sides.map(side => [side, playerData.records
          .filter(row => row.team === game[side] && row.group === key).map(row => row.playerId)]));
        observations[key] = observation(rows, playerData.previewUrl, acquired, playerData.article.modifiedAt);
      }
    }
  }
  sources.push({ ...verification, key: "homeAdvantage" });

  const urls = endpoints(game.gameId);
  const archived = Object.fromEntries(Object.entries(urls).map(([key, url]) => {
    const row = bundle.archive?.[key];
    sources.push(describeSource(key, row));
    return [key, accepts(row) ? readSource(row, url) : null];
  }));
  const { components, goalie32Factors, reason: archiveIssue } = extractComponents(game,
    archived.components, archived.archivedSchedule, bundle.archive?.components?.retrievedAt, urls.components);
  const missing = [...required.filter(key => !Object.hasOwn(observations, key)),
    ...Object.keys(affected).filter(key => !Object.hasOwn(components, key)),
    ...(!goalie32Factors ? [goalieKey] : [])];
  const reason = base.mode === "probe" ? "diagnostic_outside_window"
    : !eligibleWindow ? "capture_outside_window"
      : !independentOk ? "official_schedule_not_confirmed"
        : missing.length ? archiveIssue ?? "required_inputs_missing" : null;
  const manifest = { schema: policy.id, gameId: game.gameId, away: game.away, home: game.home,
    scheduledAt: game.scheduledAt, referenceAt: game.referenceAt, observations };
  const componentSource = bundle.archive?.components;
  const componentEvidence = Object.entries(components).map(([key, row]) => ({
    ...describeSource(key, componentSource), modelVersion: affected[key][1], computedAt: row.predictedAt
  }));
  if (goalie32Factors) componentEvidence.push({
    ...describeSource(goalieKey, componentSource), modelVersion: affected.goalie32[1], computedAt: components.goalie32.predictedAt
  });
  const input = reason ? null : { schema: "banger-core-v26-input-v1", mode: "exact", gameId: game.gameId,
    scheduledAt: game.scheduledAt, referenceAt: game.referenceAt, components, goalie32Factors };
  return { game, manifest, input, sources, componentEvidence, missing, reason, archiveIssue, mode: base.mode, finishedAt: bundle.finishedAt };
}

function archivePayload(bundle, now) {
  const view = analyze(bundle);
  const cutoff = timestamp(view.game.referenceAt);
  if (view.mode !== "capture" || now < timestamp(bundle.finishedAt) || now > cutoff
    || view.reason === "capture_outside_window") throw Error("Sealing requires a capture inside the T−60 window");
  const checked = inspectManifest(view.manifest, now);
  if (checked.status === "rejected") throw Error("Invalid manifest: " + checked.reason);
  const result = view.input ? replay(view.input) : null;
  const pair = result?.models.length === 2 && result.models.every(model => model.status === "calculated") ? result : null;
  const pairAudit = pair ? {
    computedAt: iso(now), inputSha256: pair.snapshotSha256, sourceVersion: pair.source.version,
    outputSha256: Object.fromEntries(pair.models.map(model => [model.model, sha256(model)])),
    delta: Object.fromEntries(sides.map(side => [side, pair.models[1][side] - pair.models[0][side]]))
  } : null;
  return { schema: archiveFormat, capture: bundle, manifest: view.manifest, input: view.input, pair, pairAudit,
    missing: view.missing, reason: view.reason ?? (pair ? null : "model_gate_declined"), archivedAt: iso(now) };
}

function seal(bundle, key, clock = Date.now) {
  const at = clock();
  const payload = archivePayload(bundle, at);
  const external = prepareExport(payload.manifest, key, at, sha256(payload));
  if (!inRange(iso(clock()), at, timestamp(payload.manifest.referenceAt))) throw Error("Signing finished after T−60");
  return { ...payload, external };
}

function verifyArchive(archive, expectedSignerSha256) {
  const { external, ...payload } = archive;
  if (payload.schema !== archiveFormat) throw Error("Invalid live archive format");
  verifyExport(external);
  if (expectedSignerSha256 !== undefined && publicPin(external.envelope.publicKey) !== expectedSignerSha256) {
    throw Error("Pilot signer is not pinned");
  }
  const statement = external.envelope.statement;
  const reproduced = archivePayload(payload.capture, timestamp(payload.archivedAt));
  if (!Object.hasOwn(payload, "pairAudit")) delete reproduced.pairAudit;
  if (statement.bindingSha256 !== sha256(payload) || statement.localCreatedAt !== payload.archivedAt
    || !same(external.envelope.manifest, payload.manifest)
    || !same(reproduced, payload)) {
    throw Error("Signed pilot archive does not match inputs and predictions");
  }
  return payload;
}

function dashboard(data) {
  const archived = data?.schema === archiveFormat ? verifyArchive(data) : null;
  const view = analyze(archived ? archived.capture : data);
  const status = archived ? (archived.pair ? "internally_archived" : "diagnostic_archived")
    : view.reason ? "diagnostic" : "captured";
  return { schema: "banger-accuracy-live-report-v1", game: view.game, status, missing: view.missing,
    reason: archived?.reason ?? view.reason, archiveIssue: view.archiveIssue, finishedAt: view.finishedAt, sources: view.sources, componentEvidence: view.componentEvidence,
    timeStatus: archived ? "external_confirmation_pending" : "unverified", completeSnapshots: 0, validPairs: 0,
    internallyCalculated: archived?.pair?.models ?? [], pairAudit: archived?.pairAudit ?? null, modelInputSha256: archived?.pair?.snapshotSha256 ?? null };
}

function read(file) {
  if (statSync(file).size > 32_000_000) throw Error("Input file too large");
  return JSON.parse(readFileSync(file, "utf8"));
}

if (require.main === module) {
  const [command, first, second, third] = process.argv.slice(2);
  (async () => {
    if (["capture", "probe"].includes(command) && third) writeArchive(await collectPilot(first, second, command), third);
    else if (command === "seal" && third) writeArchive(seal(read(first), readFileSync(second)), third);
    else if (command === "status" && second) writeArchive(dashboard(read(first)), second);
    else if (command === "export-time" && second) {
      const archive = read(first);
      verifyArchive(archive);
      writeArchive(archive.external, second);
    } else throw Error("Usage: pilot.cjs capture|probe DATE GAME_ID OUTPUT | seal CAPTURE KEY OUTPUT | status INPUT OUTPUT | export-time ARCHIVE OUTPUT");
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { collectPilot, analyze, seal, dashboard, verifyArchive };
