"use strict";
const assert = require("node:assert/strict");
const { createServer, PATH } = require("../../security/local/security98-api-fixture.cjs");
(async () => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const call = (method, role, path = PATH) => fetch(base + path, {
    method, headers: role ? { "x-test-role": role } : {}
  });
  try {
    for (const role of ["anon", "authenticated"]) {
      const response = await call("GET", role);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json();
      assert.equal(body.length, 1);
      assert.equal(body[0].game_id, 1);
      assert.equal(body[0].core43_away, 2.2);
      assert.equal(body[0].away_gsax_per100, 1.5);
      assert(!JSON.stringify(body).includes("PRIVATE"));
      const head = await call("HEAD", role);
      assert.equal(head.status, 200);
      assert.equal(await head.text(), "");
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const denied = await call(method, role);
        assert.equal(denied.status, 405);
        assert.equal((await denied.json()).code, "METHOD_NOT_ALLOWED");
      }
    }
    assert.equal((await call("GET")).status, 401);
    assert.equal((await call("GET", "service_role")).status, 403);
    assert.equal((await call("GET", "anon", "/rest/v1/nhl_core43_shadow_inputs")).status, 404);
    assert.equal((await call("GET", "anon", "/rest/v1/core43_shadow_predictions_v1")).status, 404);
    console.log("PASS SECURITY-98 loopback HTTP simulation: public reads, denied writes, hidden paths");
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
