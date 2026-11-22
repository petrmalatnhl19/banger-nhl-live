# SECURITY-274 minimal integration

This branch selectively carries forward the TV statistics error-message fix from Draft PR #274. It intentionally excludes the signed archive, Unix socket, SQLite service and experimental security frameworks.

## Validation
The frontend-smoke workflow runs `node .github/scripts/test-security274-tv-error.cjs` alongside existing lineup, goalie and frontend checks. The new regression prevents direct display of raw exception messages in the TV panel. It is a static source-level guard, not proof of browser rendering or API security.

## Database permissions: separate remediation, not applied
The November 22 audit reported excessive TRUNCATE grants to anon/authenticated on `public.favorite_players` and `public.nhl_core43_shadow_inputs`, and broad PUBLIC privileges in schema `net`. These are audit findings, not changes in this PR. Before any production change, independently confirm the current grants and exposed API schemas, reproduce the minimal revoke on a disposable PostgreSQL/Supabase instance, verify authorized reads/writes and TV panel consumers, then obtain explicit approval for deployment.

Do not revoke SELECT on public-facing views without mapping consumers. No database credentials or production connection are required for this PR.

## Rollback
Revert the single squash merge commit if the TV panel behavior regresses; no database migration or persistent data transformation is involved.

Original PR #274 remains Draft and untouched.
