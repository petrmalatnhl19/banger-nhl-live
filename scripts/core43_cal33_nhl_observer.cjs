"use strict";

const { createHash, createPrivateKey, createPublicKey, sign, verify } = require("node:crypto");
const { readBoundedFile } = require("./core43_cal08_receiver.cjs");
const { finalOutcome } = require("./core43_cal11_evaluate.cjs");

const ARCHIVE = "core43_cal33_nhl_sources_v1";
const START = "core43_cal30_nhl_start_v1";
const PROVENANCE = "core43_cal33_nhl_provenance_v1";
const REPORT_LIMIT = 2 * 1024 * 1024;
const BOXSCORE_LIMIT = 512 * 1024;
const ARCHIVE_LIMIT = 4 * 1024 * 1024;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const encode = bytes => bytes.toString("base64url");
const json = value => Buffer.from(JSON.stringify(value));
const message = (domain, bytes) => Buffer.concat([Buffer.from(domain + "\0"), bytes]);
const instant = value => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const zones = new Map([["EST",-300],["EDT",-240],["CST",-360],["CDT",-300],["MST",-420],["MDT",-360],
  ["PST",-480],["PDT",-420],["AST",-240],["ADT",-180]]);
const calendar = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC", weekday: "long", month: "long", day: "numeric", year: "numeric",
});

function check(condition, reason) {
  if (!condition) throw Error("cal33_" + reason);
}

function fields(value, names) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
}

function urls(gameId) {
  check(typeof gameId === "string" && /^\d{10}$/.test(gameId) && gameId.length === 10, "game_id");
  const season = Number(gameId.slice(0, 4));
  return {
    report: `https://www.nhl.com/scores/htmlreports/${season}${season + 1}/GS${gameId.slice(4)}.HTM`,
    boxscore: `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`,
  };
}

async function acquire(url, expectedType, limit) {
  const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000) });
  check(response.ok && response.url === url && response.body &&
    response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === expectedType, "source_http");
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.length;
    check(length <= limit, "source_size");
    chunks.push(chunk);
  }
  check(length > 0, "source_size");
  const bytes = Buffer.concat(chunks, length);
  return { url, retrievedAt: new Date().toISOString(), sha256: hash(bytes), bytes: encode(bytes) };
}

async function collectNhlSources(gameId) {
  const sources = urls(gameId);
  const [report, boxscore] = await Promise.all([
    acquire(sources.report, "text/html", REPORT_LIMIT),
    acquire(sources.boxscore, "application/json", BOXSCORE_LIMIT),
  ]);
  return { schema: ARCHIVE, gameId, report, boxscore };
}

function readArchive(bytes) {
  check(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= ARCHIVE_LIMIT, "archive");
  const archive = JSON.parse(new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes));
  check(json(archive).equals(bytes) && fields(archive, ["schema", "gameId", "report", "boxscore"]) &&
    archive.schema === ARCHIVE, "archive");
  return archive;
}

function source(record, url, limit) {
  check(fields(record, ["url", "retrievedAt", "sha256", "bytes"]) && record.url === url &&
    instant(record.retrievedAt) && typeof record.bytes === "string" &&
    record.bytes.length <= Math.ceil(limit * 4 / 3), "source_record");
  const bytes = Buffer.from(record.bytes, "base64url");
  check(bytes.length > 0 && bytes.length <= limit && encode(bytes) === record.bytes &&
    hash(bytes) === record.sha256, "source_integrity");
  return bytes;
}

function readStartMarker(report, boxscore, gameId) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(report)
    .replace(/<!--[\s\S]*?-->|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // Recognize the official final Game Summary header. Unknown layouts require a parser update.
  const headers = [...text.matchAll(/<table\b[^>]*\bid="(Visitor|GameInfo|Home)"[^>]*>([\s\S]*?)<\/table>/gi)];
  const header = label => {
    const tables = headers.filter(match => match[1].toLowerCase() === label);
    check(tables.length === 1, "report_header");
    return tables[0][2].replace(/&nbsp;|&#160;|\u00a0/gi, " ");
  };
  for (const [label, team] of [["visitor", boxscore.awayTeam], ["home", boxscore.homeTeam]]) {
    const teamLogos = [...header(label).matchAll(/\blogoc([a-z]{3})\.gif\b/gi)]
      .map(match => match[1].toUpperCase()).filter(code => code !== "NHL");
    check(teamLogos.length === 1 && teamLogos[0] === team.abbrev, "report_teams");
  }
  const info = header("gameinfo");
  const cells = [...info.matchAll(/<td\b[^>]*>\s*([^<>]*?)\s*<\/td>/gi)].map(match => match[1]);
  check(cells.includes("Game Summary") && cells.includes("Game " + gameId.slice(-4)) &&
    cells.includes("Final"), "report_identity");
  const markers = cells.filter(cell => /^Start\b/i.test(cell));
  const stamp = markers.length === 1 &&
    /^Start\s+(1[0-2]|[1-9]):([0-5]\d)\s+([A-Z]{3});\s+End\s+(?:1[0-2]|[1-9]):[0-5]\d\s+\3$/.exec(markers[0]);
  check(stamp && zones.has(stamp[3]), "actual_start_unavailable");
  return { cells, stamp, marker: markers[0] };
}

function startMarker(report, boxscore, gameId, actualStartAt) {
  const { cells, stamp, marker } = readStartMarker(report, boxscore, gameId);
  const local = new Date(Date.parse(actualStartAt) + zones.get(stamp[3]) * 60000);
  check(cells.includes(calendar.format(local)) && (local.getUTCHours() % 12 || 12) === Number(stamp[1]) &&
    local.getUTCMinutes() === Number(stamp[2]), "actual_start_mismatch");
  return marker;
}

function verifyTechnicalNhlStart(archiveBytes, prediction, reviewAt) {
  const archive = readArchive(archiveBytes);
  const sources = urls(archive.gameId);
  const report = source(archive.report, sources.report, REPORT_LIMIT);
  const boxscore = JSON.parse(source(archive.boxscore, sources.boxscore, BOXSCORE_LIMIT).toString("utf8"));
  const { cells, stamp } = readStartMarker(report, boxscore, archive.gameId);
  check(typeof boxscore.gameDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(boxscore.gameDate), "game_date");
  const day = Date.parse(boxscore.gameDate + "T00:00:00.000Z");
  check(Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === boxscore.gameDate &&
    cells.includes(calendar.format(day)), "game_date");
  const retrieved = [archive.report, archive.boxscore].map(record => Date.parse(record.retrievedAt));
  check(retrieved.every(at => at <= Date.parse(reviewAt)), "acquisition_time");
  const hour = Number(stamp[1]) % 12;
  const candidates = [hour, hour + 12]
    .map(value => day + (value * 60 + Number(stamp[2]) - zones.get(stamp[3])) * 60000)
    .filter(at => retrieved.every(retrievedAt => at < retrievedAt));
  check(candidates.length > 0, "acquisition_time");
  const earliest = new Date(candidates[0]).toISOString();
  const outcome = finalOutcome({ origin: "historical", sourceUrl: sources.boxscore, boxscore,
    officialStart: { url: sources.report, at: earliest } }, "historical");
  check(outcome && archive.gameId === prediction.gameId && String(boxscore.id) === archive.gameId &&
    outcome.kickoff === prediction.kickoffAt && outcome.awayTeam === prediction.awayTeam &&
    outcome.homeTeam === prediction.homeTeam, "boxscore_binding");
  return { cutoffMs: Math.min(Date.parse(outcome.kickoff), candidates[0]),
    startEvidence: candidates.length === 1 ? "single_report_time" : "conservative_am_pm_bound",
    earliestReportStartAt: earliest };
}

function attestNhlStart(archiveBytes, review, privateKey, clock = Date.now) {
  const archive = readArchive(archiveBytes);
  const sources = urls(archive.gameId);
  const report = source(archive.report, sources.report, REPORT_LIMIT);
  const boxscore = JSON.parse(source(archive.boxscore, sources.boxscore, BOXSCORE_LIMIT).toString("utf8"));
  check(fields(review, ["actualStartAt", "clockCorroboration"]) && instant(review.actualStartAt) &&
    Date.parse(review.actualStartAt) % 60000 === 0 &&
    typeof review.clockCorroboration === "string" && review.clockCorroboration.trim().length > 0 &&
    review.clockCorroboration.length <= 2000, "observer_review");
  const { actualStartAt } = review;
  const outcome = finalOutcome({ origin: "historical", sourceUrl: sources.boxscore, boxscore,
    officialStart: { url: sources.report, at: actualStartAt } }, "historical");
  check(outcome && String(boxscore.id) === archive.gameId, "boxscore_binding");
  const marker = startMarker(report, boxscore, archive.gameId, actualStartAt);
  const observedAt = new Date(clock()).toISOString();
  check([archive.report, archive.boxscore].every(record =>
    actualStartAt < record.retrievedAt && record.retrievedAt <= observedAt), "acquisition_time");
  check(privateKey?.type === "private" && privateKey.asymmetricKeyType === "ed25519", "observer_key");
  const statement = json({ schema: START, gameId: archive.gameId, kickoffAt: outcome.kickoff,
    awayTeam: outcome.awayTeam, homeTeam: outcome.homeTeam, url: sources.report, reportSha256: archive.report.sha256,
    actualStartAt, precision: "minute", observedAt });
  const signature = sign(null, message(START, statement), privateKey);
  const provenance = json({ schema: PROVENANCE, archiveSha256: hash(archiveBytes), statementSha256: hash(statement),
    signatureSha256: hash(signature), marker, clockCorroboration: review.clockCorroboration });
  return { trusted: false, nhlStart: { report: encode(report), statement: encode(statement), signature: encode(signature) },
    provenance: encode(provenance), provenanceSignature: encode(sign(null, message(PROVENANCE, provenance), privateKey)) };
}

function verifyProvenance(archiveBytes, attestation, observerKey) {
  try {
    const decode = value => {
      const bytes = Buffer.from(value, "base64url");
      check(encode(bytes) === value, "provenance_encoding");
      return bytes;
    };
    const provenance = decode(attestation.provenance);
    const statement = decode(attestation.nhlStart.statement);
    const signature = decode(attestation.nhlStart.signature);
    const record = JSON.parse(provenance);
    const archive = readArchive(archiveBytes);
    return observerKey?.type === "public" && observerKey.asymmetricKeyType === "ed25519" &&
      record.schema === PROVENANCE && record.archiveSha256 === hash(archiveBytes) &&
      record.statementSha256 === hash(statement) && record.signatureSha256 === hash(signature) &&
      decode(attestation.nhlStart.report).equals(source(archive.report, urls(archive.gameId).report, REPORT_LIMIT)) &&
      verify(null, message(START, statement), observerKey, signature) &&
      verify(null, message(PROVENANCE, provenance), observerKey, decode(attestation.provenanceSignature));
  } catch {
    return false;
  }
}

async function main(args) {
  const [command, first, second, third] = args;
  if (command === "collect" && args.length === 2) return collectNhlSources(first);
  if (command === "attest" && args.length === 4) {
    const archive = readBoundedFile(first, ARCHIVE_LIMIT);
    const review = JSON.parse(readBoundedFile(second, 4096));
    return attestNhlStart(archive, review, createPrivateKey(readBoundedFile(third, 4096)));
  }
  if (command === "verify" && args.length === 4) {
    const archive = readBoundedFile(first, ARCHIVE_LIMIT);
    const attestation = JSON.parse(readBoundedFile(second, ARCHIVE_LIMIT));
    const key = createPublicKey(readBoundedFile(third, 4096));
    check(verifyProvenance(archive, attestation, key), "provenance");
    return { trusted: false, status: "provenance_verified" };
  }
  throw Error("cal33_usage");
}

if (require.main === module) {
  main(process.argv.slice(2)).then(result => {
    process.stdout.write(JSON.stringify(result) + (result.schema === ARCHIVE ? "" : "\n"));
  }).catch(error => {
    const reason = /^cal33_[a-z_]+$/.test(error.message) ? error.message : "cal33_failed";
    process.stdout.write(JSON.stringify({ trusted: false, status: "rejected", reason }) + "\n");
    process.exitCode = 1;
  });
}

module.exports = { attestNhlStart, collectNhlSources, verifyProvenance, verifyTechnicalNhlStart };
