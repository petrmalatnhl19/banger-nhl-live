"use strict";
// SECURITY-98: local HTTP gateway simulation. NOT a Supabase/PostgREST integration.
const http = require("node:http");
const { publishTvRows } = require("./security95-public-contract.cjs");
const PATH = "/rest/v1/core43_tv_public_v1";
const fixture = Object.freeze({
  archive: [{ game_id: 1, status: "pending" }],
  predictions: [{ game_id: 1, core42_away: 2, core42_home: 3, core43_away: 2.2, core43_home: 3.3, secret: "PRIVATE" }],
  previews: [{ game_id: 1, away_gsax_per100: 1.5, home_gsax_per100: 2.5, secret: "PRIVATE" }]
});
function handler(req, res) {
  const path = new URL(req.url, "http://localhost").pathname;
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store", ...headers });
    res.end(JSON.stringify(body));
  };
  if (path !== PATH) return send(404, { code: "NOT_FOUND" });
  if (req.method !== "GET" && req.method !== "HEAD") return send(405, { code: "METHOD_NOT_ALLOWED" }, { allow: "GET, HEAD" });
  if (req.headers["x-test-role"] === "service_role") return send(403, { code: "ROLE_NOT_PUBLIC" });
  if (!["anon", "authenticated"].includes(req.headers["x-test-role"])) return send(401, { code: "AUTH_REQUIRED" });
  const payload = publishTvRows(fixture);
  if (req.method === "HEAD") {
    res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    return res.end();
  }
  return send(200, payload);
}
module.exports = { PATH, handler, createServer: () => http.createServer(handler) };
