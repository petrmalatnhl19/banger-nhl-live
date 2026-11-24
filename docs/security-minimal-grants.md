# TV errors and database grants

The TV panel shows a stable Czech retry message if its archive fails. The browser fixture exercises successful scores, denied shadow views, HTTP failure and malformed JSON. The PostgreSQL 17 fixture narrows the ACL snapshot and restoration test from #274 to two tables, two API roles and one privilege. It checks effective privileges before removal, after removal and after restoration, plus the complete restored ACL. It models object privileges only. The client, database schema and public projections have separate access contracts.

## Repeat the checks

From the repository root, use the Playwright version and Chromium installation in the frontend smoke workflow, then run `node .github/scripts/browser-tv-grants.cjs`. Requests from this test are intercepted locally.

For the grant test use a new PostgreSQL 17 container with no published ports or persistent volume. These commands require Docker and no production credentials.

```sh
fixture=$(docker run -d --rm -e POSTGRES_DB=grants_fixture -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17)
trap 'docker stop "$fixture" >/dev/null' EXIT
until docker exec "$fixture" pg_isready -q -U postgres -d grants_fixture -h 127.0.0.1; do sleep 1; done
docker exec -i "$fixture" psql -X -v ON_ERROR_STOP=1 -U postgres -d grants_fixture < .github/scripts/test-db-grants.sql
```

Both regressions are in the frontend smoke workflow. To roll back the application change after integration, revert this PR's merge/squash commit and rerun frontend and browser smoke. This PR requires no database rollback.

## Production review and proposed rehearsal (22 November 2026)

Read-only catalog inspection of app-development and consumer inspection on main. No production rows were queried. Before a separately approved change, snapshot the roles, memberships, owners, ACLs (including grantors and grant options), policies and view definitions from that day's catalog. Use an isolated copy with synthetic rows and offline network fixtures.

1. **Table TRUNCATE.** Both anon and authenticated hold direct and effective TRUNCATE on public.favorite_players and public.nhl_core43_shadow_inputs. Both tables have RLS. Favorites has authenticated SELECT, INSERT and DELETE policies limited to auth.uid() = user_id. Shadow inputs has no client policy. TRUNCATE can empty a table outside row policies if an execution path exists. Reachability from the web client was not demonstrated. On the copy, remove only TRUNCATE on both tables from both roles as in the fixture. Check all four effective rights, the entire remaining ACL, two users' isolated favorites operations and a representative collector write. Restore only the original four direct grants as the original grantor and compare the restored ACL with the snapshot.
2. **net.** PUBLIC has schema USAGE and EXECUTE on all 12 functions. Both API roles also have direct USAGE and effective EXECUTE on all 12. None is SECURITY DEFINER. Catalog rights alone do not establish Data API exposure or successful outbound requests. Unneeded access could allow use of network functions, while indiscriminate removal could break scheduled jobs or webhooks. Inventory exposed schemas, function signatures, owners, cron jobs, triggers, queues and server callers. On the copy, establish the precise service grants first, then restrict only confirmed unnecessary public and direct grants. Check effective rights under both API roles and exercise required callers against a local stub. Restore original per-signature and schema ACLs, grantors and grant options, then repeat the service checks.
3. **Public views.** Eight views allow anon SELECT without security_invoker=true. The TV panel reads core43_shadow_predictions_v1 and core43_shadow_preview_v1 plus the separate nhl_prediction_archive table. Analytics uses nhl_core42_status, nhl_core_model_accuracy, nhl_core_model_head_to_head and nhl_core_model_trend. Analytics and the verified dashboard use nhl_core43_public_schedule_evidence. Confirm the consumers of core43_shadow_readiness_v1 before changing it. Owner-based access can expose rows or columns unavailable directly; broad revocation can hide scores or analytics. Agree the public fields per view, inventory underlying relations and external consumers, then narrow only an identified overexposure. On the copy compare columns, rows and rendered values for anon, signed-in users and service consumers. Recheck the archive separately. Restore the original view definition, owner, security options and ACL for each changed view, then compare the same outputs again.

The fixture does not establish production API exposure, job compatibility or permission to execute a production change.
