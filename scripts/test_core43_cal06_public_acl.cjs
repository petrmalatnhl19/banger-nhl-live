"use strict";
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const { PGlite } = require("@electric-sql/pglite");

const migration = readFileSync("docs/sql/core43-cal06-reader-migration-draft.sql", "utf8");
const preflight = migration.match(/^DO \$reader_acl_check\$\n[\s\S]+?^\$reader_acl_check\$;$/m)?.[0];
assert.ok(preflight, "extract the ACL check only");
assert.ok(migration.indexOf(preflight) < migration.indexOf("GRANT SELECT (%s)"));
assert.ok(migration.indexOf(preflight) < migration.indexOf("TO authenticator"));
assert.doesNotMatch(preflight, /\b(?:GRANT|REVOKE|CREATE|ALTER|DROP|EXECUTE)\s+(?:ON|ROLE|TABLE|FUNCTION|SCHEMA|POLICY)\b/i);

test("CAL-06 effective PUBLIC privileges", async t => {
  const db = new PGlite();
  try {
    const { rows: [{ server_version: version }] } = await db.query("SHOW server_version");
    assert.match(version, /^17\./);
    await db.exec(`
      SET search_path = pg_catalog;
      CREATE ROLE core43_cal04_reader NOLOGIN NOINHERIT NOBYPASSRLS;
      GRANT USAGE ON SCHEMA public TO core43_cal04_reader;
    `);

    const cases = [
      { name: "no net schema or extra grants" },
      {
        name: "private net schema with default PUBLIC function EXECUTE",
        setup: `
          CREATE SCHEMA net;
          CREATE FUNCTION net.http_post() RETURNS integer LANGUAGE sql AS 'SELECT 1';
        `,
      },
      {
        name: "net USAGE via PUBLIC with no routines or relations",
        setup: "CREATE SCHEMA net; GRANT USAGE ON SCHEMA net TO PUBLIC;",
        error: "schema USAGE access: net",
      },
      {
        name: "role-specific revokes leave PUBLIC net USAGE and EXECUTE in effect",
        setup: `
          CREATE SCHEMA net;
          GRANT USAGE ON SCHEMA net TO PUBLIC;
          CREATE FUNCTION net.http_post() RETURNS integer LANGUAGE sql AS 'SELECT 1';
          CREATE TABLE net.http_request_queue(id integer);
          GRANT SELECT ON net.http_request_queue TO PUBLIC;
          REVOKE USAGE ON SCHEMA net FROM core43_cal04_reader;
          REVOKE EXECUTE ON FUNCTION net.http_post() FROM core43_cal04_reader;
        `,
        effective: `SELECT has_schema_privilege('core43_cal04_reader', 'net', 'USAGE')
          AND has_function_privilege('core43_cal04_reader', 'net.http_post()', 'EXECUTE')
          AND has_table_privilege('core43_cal04_reader', 'net.http_request_queue', 'SELECT') AS allowed`,
        error: "schema USAGE access: net",
      },
      {
        name: "default PUBLIC function EXECUTE in a usable application schema",
        setup: "CREATE FUNCTION public.acl_fixture() RETURNS integer LANGUAGE sql AS 'SELECT 1';",
        error: "routine access: public.acl_fixture",
      },
      {
        name: "PUBLIC column write grant",
        setup: "CREATE TABLE public.acl_fixture(id integer); GRANT INSERT (id) ON public.acl_fixture TO PUBLIC;",
        error: "relation access: public.acl_fixture",
      },
      {
        name: "PUBLIC table read grant",
        setup: "CREATE TABLE public.acl_fixture(id integer); GRANT SELECT ON public.acl_fixture TO PUBLIC;",
        error: "relation access: public.acl_fixture",
      },
      {
        name: "PUBLIC sequence grant",
        setup: "CREATE SEQUENCE public.acl_fixture; GRANT USAGE ON SEQUENCE public.acl_fixture TO PUBLIC;",
        error: "relation access: public.acl_fixture",
      },
      {
        name: "PUBLIC schema CREATE",
        setup: "GRANT CREATE ON SCHEMA public TO PUBLIC;",
        error: "schema CREATE access: public",
      },
    ];

    for (const scenario of cases) {
      await t.test(scenario.name, async () => {
        await db.exec("BEGIN");
        try {
          if (scenario.setup) await db.exec(scenario.setup);
          if (scenario.effective) {
            const { rows: [{ allowed }] } = await db.query(scenario.effective);
            assert.equal(allowed, true, "PUBLIC remains effective after the role-specific revokes");
          }
          if (scenario.error) {
            await assert.rejects(db.exec(preflight), {
              code: "P0001",
              message: `Reader has unexpected ${scenario.error}`,
            });
          } else {
            await db.exec(preflight);
          }
        } finally {
          await db.exec("ROLLBACK");
        }
      });
    }
  } finally {
    await db.close();
  }
});
