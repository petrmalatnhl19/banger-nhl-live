"use strict";

const { createCipheriv, createDecipheriv, randomBytes } = require("node:crypto");
const { mkdirSync, readFileSync, statSync } = require("node:fs");
const { join } = require("node:path");
const { canonical, timestamp } = require("./engine.js");
const { fetchSource, readSource } = require("./pregame.cjs");
const { collectPilot, analyze, seal, dashboard } = require("./pilot.cjs");
const { sha256 } = require("./reference.cjs");
const { writeArchive } = require("./snapshot.cjs");

const plan = Object.freeze({
  gameDate: "2026-11-17", gameId: "2026020342", away: "DAL", home: "VGK",
  scheduledAt: "2026-11-18T03:00:00Z", opensAt: "2026-11-18T01:45:00Z",
  referenceAt: "2026-11-18T02:00:00Z", prospectiveUtcCron: "46 1 18 11 *",
  artifact: "accuracy-pilot-2026020342-20261118T0200Z"
});
const landing = "https://api-web.nhle.com/v1/gamecenter/" + plan.gameId + "/landing";
const deadline = timestamp(plan.referenceAt);
const iso = ms => new Date(ms).toISOString();
const cipherFormat = "banger-accuracy-pilot-encrypted-v1";

function scheduleMatches(game) {
  return game?.gameId === plan.gameId && game.gameDate === plan.gameDate
    && game.away === plan.away && game.home === plan.home
    && timestamp(game.scheduledAt) === timestamp(plan.scheduledAt)
    && timestamp(game.opensAt) === timestamp(plan.opensAt) && timestamp(game.referenceAt) === deadline;
}

function checkLanding(source, now) {
  const row = readSource(source, landing);
  const received = timestamp(source?.retrievedAt);
  return !!row && String(row.id) === plan.gameId && row.gameDate === plan.gameDate
    && row.awayTeam?.abbrev === plan.away && row.homeTeam?.abbrev === plan.home
    && ["FUT", "PRE"].includes(row.gameState) && timestamp(row.startTimeUTC) === timestamp(plan.scheduledAt)
    && timestamp(source.requestedAt) >= timestamp(plan.opensAt) && received <= Math.min(now, deadline);
}

function limitedFetch(fetcher, { now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)),
  cutoff = deadline, events = [] } = {}) {
  return async (url, options) => {
    if (options.method !== "GET") throw Error("Pilot only supports GET");
    if (now() >= cutoff) throw Error("Collection window closed");
    const attempts = 2;
    for (let i = 1; i <= attempts; i++) {
      const startedAt = iso(now());
      let response, fault;
      try {
        response = await fetcher(url, options);
      } catch (error) {
        fault = error;
      }
      events.push({ source: url, attempt: i, startedAt, finishedAt: iso(now()), httpStatus: response?.status ?? null });
      const retryable = fault || [408, 425, 429, 500, 502, 503, 504].includes(response?.status);
      if (retryable && i < attempts && !options.signal?.aborted) {
        const raw = response?.headers.get("retry-after");
        const header = /^\d+$/.test(raw ?? "") ? Number(raw) * 1000 : Date.parse(raw) - now();
        const delay = Math.max(800, Number.isFinite(header) ? header : 0);
        if (delay <= 5000 && now() + delay + 15000 < cutoff) {
          await response?.body?.cancel();
          await wait(delay);
          if (now() < cutoff) continue;
        }
      }
      if (fault) throw fault;
      return response;
    }
    throw Error("Retry exhausted");
  };
}

function keyFrom(text) {
  if (typeof text !== "string" || !/^[a-fA-F0-9]{64}$/.test(text)) throw Error("An external AES-256 archive key is required");
  return Buffer.from(text, "hex");
}

function encrypt(payload, key) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const clear = Buffer.from(canonical(payload));
  cipher.setAAD(Buffer.from(cipherFormat));
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  return { schema: cipherFormat, nonce: nonce.toString("hex"), tag: cipher.getAuthTag().toString("hex"),
    ciphertext: encrypted.toString("base64") };
}

function decrypt(envelope, key) {
  if (envelope?.schema !== cipherFormat || !/^[0-9a-f]{24}$/.test(envelope.nonce)
    || !/^[0-9a-f]{32}$/.test(envelope.tag) || typeof envelope.ciphertext !== "string"
    || envelope.ciphertext.length > 48_000_000) throw Error("Invalid encrypted pilot archive");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.nonce, "hex"));
  decipher.setAAD(Buffer.from(cipherFormat));
  decipher.setAuthTag(Buffer.from(envelope.tag, "hex"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString());
}

function failureReport(reason, now, base) {
  return { schema: "banger-accuracy-live-report-v1", game: plan, status: "diagnostic",
    missing: base?.missing ?? [], reason, archiveIssue: null, finishedAt: iso(now),
    sources: base?.sources ?? [], componentEvidence: base?.componentEvidence ?? [],
    timeStatus: "unverified", completeSnapshots: 0, validPairs: 0, internallyCalculated: [] };
}

async function runLive({ fetcher = fetch, now = Date.now, wait, signingKey, archiveKey }) {
  const key = keyFrom(archiveKey);
  if (typeof signingKey !== "string" || !signingKey.trim()) throw Error("A signing key from outside the repository is required");
  if (now() < timestamp(plan.opensAt) || now() >= deadline) throw Error("Scheduled run is outside T−75 to T−60");
  const events = [];
  const limited = limitedFetch(fetcher, { now, wait, events });
  const official = await fetchSource(landing, limited, now);
  let capture = null, archived = null, report;
  if (!checkLanding(official, now())) {
    report = failureReport("official_schedule_not_confirmed", now());
  } else {
    try {
      capture = await collectPilot(plan.gameDate, plan.gameId, "capture", { fetcher: limited, now });
    } catch {
      report = failureReport("collection_unavailable", now());
    }
    if (capture) {
      capture.officialCrossCheck = official;
      capture.retrievalAttempts = events.slice();
      const view = analyze(capture);
      if (!scheduleMatches(view.game)) report = failureReport("official_schedule_not_confirmed", now(), dashboard(capture));
      else if (view.reason) report = dashboard(capture);
      else {
        try {
          archived = seal(capture, signingKey, now);
          report = dashboard(archived);
        } catch {
          report = failureReport("seal_refused", now(), dashboard(capture));
        }
      }
    }
  }
  const data = { plan, official, events, capture, archived };
  report.workflow = { openedAt: plan.opensAt, referenceAt: plan.referenceAt,
    checkedByGamecenter: checkLanding(official, now()), retryCount: events.filter(event => event.attempt > 1).length };
  return { report, encrypted: encrypt(data, key), sealed: !!archived?.pair };
}

function selectedArtifact(rows) {
  return (rows ?? []).filter(row => row.name === plan.artifact + "-sealed" && row.expired === false
    && row.workflow_run?.head_branch === "core-accuracy-lab-01");
}

if (require.main === module) {
  const [command, first, second] = process.argv.slice(2);
  (async () => {
    if (command === "configuration") {
      console.log(JSON.stringify({ ...plan, scheduleEnabled: false }, null, 2));
    } else if (command === "live" && first) {
      // Exclusive staging path, never overwrite an earlier local run.
      mkdirSync(first, { mode: 0o700 });
      const result = await runLive({ signingKey: process.env.ACCURACY_PILOT_SIGNING_KEY,
        archiveKey: process.env.ACCURACY_PILOT_ARCHIVE_KEY });
      writeArchive(result.encrypted, join(first, "evidence.encrypted.json"));
      writeArchive(result.report, join(first, "status.json"));
      if (result.sealed) writeArchive({ gameId: plan.gameId, referenceAt: plan.referenceAt,
        encryptedSha256: sha256(result.encrypted) }, join(first, "sealed-marker.json"));
    } else if (command === "decrypt" && first && second) {
      if (statSync(first).size > 48_100_000) throw Error("Archive exceeds size limit");
      writeArchive(decrypt(JSON.parse(readFileSync(first, "utf8")), keyFrom(process.env.ACCURACY_PILOT_ARCHIVE_KEY)), second);
    } else if (command === "artifact-ids" && first) {
      const list = JSON.parse(readFileSync(first, "utf8"));
      if (!Array.isArray(list) || list.some(row => !Number.isSafeInteger(row?.id))) throw Error("Invalid artifact listing");
      console.log(selectedArtifact(list).map(row => row.workflow_run.id).filter(Number.isSafeInteger).join("\n"));
    } else throw Error("Usage: pilot-automation.cjs configuration | live DIR | decrypt ARCHIVE OUTPUT | artifact-ids LIST");
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { plan, limitedFetch, checkLanding, scheduleMatches, encrypt, decrypt, runLive, selectedArtifact };
