# SECURITY-25 — isolated SECURITY DEFINER search_path validation

Scope: Draft PR #274, synthetic Docker PostgreSQL only. **No production DDL or deploy.**

## Added tests

- Create a temporary table named `nhl_core43_shadow_inputs` and set the session search path to `pg_temp,public`; invoke the schema-qualified capture function and verify the real public table remains intact. Transaction is rolled back.
- Inside a second rollback-only transaction, set both SECURITY DEFINER functions to the candidate `search_path = pg_catalog, public, pg_temp`, invoke the capture function, and ensure it executes.
- After rollback, assert both functions retain the baseline `search_path=public` configuration.

These tests are *narrow*. They do not cover every possible object/function/operator resolution attack, temporary-schema edge case, or trigger under hardened search_path. The hardened setting is a candidate for later review, **not a production recommendation until CI passes and compatibility is evaluated**.

## Release gate

- Confirm `Security local PostgreSQL permissions`, `Security grants proposal (offline)`, and `Frontend smoke checks` all pass on the latest commit.
- Extend tests with a trigger-driven capture under hardened search_path and role-level adversarial cases before proposing any production migration.
- Keep production **NO-GO**, PR Draft, CORE 4.2 unchanged.
