"use strict";
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const base = "http://127.0.0.1:55433";
const secret = "security99_disposable_test_secret_32chars_only";
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString("base64url");
function token(role) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ role, exp: Math.floor(Date.now() / 1000) + 300 });
  return h + "." + p + "." + createHmac("sha256", secret).update(h + "." + p).digest("base64url");
}
async function request(path, method = "GET", role) {
  const headers = role ? { authorization: "Bearer " + token(role) } : {};
  const hasBody = method === "POST" || method === "PATCH";
  if (hasBody) headers["content-type"] = "application/json";
  return fetch(base + "/" + path, { method, headers,
    ...(hasBody ? { body: JSON.stringify({ game_id: 1, core43_away: 99 }) } : {}),
    signal: AbortSignal.timeout(10000) });
}
(async () => {
  for (const role of ["anon", "authenticated"]) {
    const response = await request("security99_tv_public_v1?select=*", "GET", role);
    assert.equal(response.status, 200, role + " public GET");
    const rows = await response.json();
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "game_id","core42_away","core42_home","core43_away","core43_home",
      "core43_preview_away","core43_preview_home","away_gsax_per100","home_gsax_per100"
    ].sort());
    assert.equal(Number(rows[0].core43_away), 2.2);
    for (const method of ["POST", "PATCH", "DELETE"]) {
      const denied = await request("security99_tv_public_v1?game_id=eq.1", method, role);
      assert.equal(denied.status, 403, role + " " + method);
    }
    for (const object of ["nhl_core43_shadow_inputs","core43_shadow_predictions_v1","core43_shadow_preview_v1"]) {
      const denied = await request(object + "?select=*", "GET", role);
      assert.equal(denied.status, 403, role + " internal " + object);
    }
  }
  assert.equal((await request("security99_tv_public_v1?select=*")).status, 200);
  console.log("PASS SECURITY-99 real isolated PostgREST role/HTTP/allowlist regression");
})().catch(e => { console.error(e); process.exitCode = 1; });
