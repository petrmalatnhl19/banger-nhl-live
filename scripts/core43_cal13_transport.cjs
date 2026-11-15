"use strict";

const { createHash, timingSafeEqual } = require("node:crypto");
const { request } = require("node:https");
const { MAX_PACKAGE_BYTES } = require("./core43_cal13_coordinator.cjs");

const DIGEST = /^[a-f0-9]{64}$/;
const TOKEN = /^[A-Za-z0-9_-]{24,180}$/;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

async function readBounded(stream, limit) {
  const chunks = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.length;
    if (total > limit) throw Error("cal13_transport_size");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function requestBytes({ origin, ca, token, path, method, bytes, limit }) {
  const endpoint = new URL(origin);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      endpoint.pathname !== "/" || endpoint.search || endpoint.hash || (typeof token !== "string" || !TOKEN.test(token))) {
    return Promise.reject(Error("cal13_transport_config"));
  }
  const target = new URL(path, endpoint);
  return new Promise((resolve, reject) => {
    const req = request(target, {
      method, ca, rejectUnauthorized: true, minVersion: "TLSv1.2",
      headers: {
        Authorization: "Bearer " + token,
        ...(bytes ? { "Content-Type": "application/octet-stream", "Content-Length": bytes.length } : {}),
      },
    }, response => {
      if (response.statusCode !== 200) {
        response.destroy();
        reject(Error("cal13_http_" + response.statusCode));
        return;
      }
      readBounded(response, limit).then(resolve, reject);
    });
    const timer = setTimeout(() => req.destroy(Error("cal13_transport_timeout")), 5000);
    req.once("close", () => clearTimeout(timer));
    req.once("error", reject);
    req.end(bytes);
  });
}

async function downloadPackage(config, digest) {
  if (typeof digest !== "string" || !DIGEST.test(digest)) throw Error("cal13_digest");
  const bytes = await requestBytes({ ...config, path: "/objects/" + digest, method: "GET", limit: MAX_PACKAGE_BYTES });
  if (sha(bytes) !== digest) throw Error("cal13_download_integrity");
  return bytes;
}

async function submitPackage(config, bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_PACKAGE_BYTES) throw Error("cal13_package_size");
  const payload = await requestBytes({
    ...config, path: "/submissions/" + sha(bytes), method: "POST", bytes, limit: 1024,
  });
  const result = JSON.parse(payload);
  if (!["accepted", "duplicate", "conflict"].includes(result?.status) || !DIGEST.test(result?.digest ?? "") ||
      (result.status !== "conflict" && result.digest !== sha(bytes))) throw Error("cal13_submit_response");
  return result;
}

function sameToken(header, token) {
  if (typeof header !== "string" || !/^Bearer [A-Za-z0-9_-]+$/.test(header) ||
      header.length !== token.length + 7) return false;
  return timingSafeEqual(Buffer.from(header), Buffer.from("Bearer " + token));
}

// Local adapter for exercising the role boundary over real TLS. The deployment
// must supply the object reader and coordinator and configure its own identity provider.
function makeHandler({ readToken, submitToken, readObject, submit }) {
  if (![readToken, submitToken].every(token => typeof token === "string" && TOKEN.test(token)) ||
      readToken === submitToken) {
    throw Error("cal13_transport_roles");
  }
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const route = /^\/(objects|submissions)\/([a-f0-9]{64})$/.exec(req.url);
    if (!route) { res.writeHead(404).end(); return; }
    const [, action, digest] = route;
    const reading = action === "objects";
    if (!sameToken(req.headers.authorization, reading ? readToken : submitToken)) {
      res.writeHead(403).end(); return;
    }
    if (req.method !== (reading ? "GET" : "POST")) {
      res.writeHead(405).end(); return;
    }
    if (reading) {
      try {
        const bytes = await readObject(digest);
        if (!Buffer.isBuffer(bytes) || bytes.length > MAX_PACKAGE_BYTES) { res.writeHead(404).end(); return; }
        res.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": bytes.length }).end(bytes);
      } catch {
        res.writeHead(503).end();
      }
      return;
    }

    let bytes;
    try { bytes = await readBounded(req, MAX_PACKAGE_BYTES); }
    catch { if (!res.destroyed) res.writeHead(413).end(); return; }
    if (sha(bytes) !== digest) { res.writeHead(400).end(); return; }
    try {
      const result = await submit(bytes);
      const body = JSON.stringify(result);
      res.writeHead(200, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }).end(body);
    } catch {
      res.writeHead(422).end();
    }
  };
}

module.exports = { downloadPackage, submitPackage, makeHandler };
