# SECURITY-30 — production CORE43 capture cron role and execution audit

Date: 2026-11-16. **Read-only** production SQL inspection, Supabase project `app-development` (`xxwqeiuyislnoxsmjuul`). No job invocation, permission change, deployment, or database write.

## Job 5: banger-core43-shadow-capture

| Field | Verified value |
| --- | --- |
| Active | true |
| Schedule | `25 */2 * * *` (minute 25, every two hours) |
| Cron database and role | `postgres` / `postgres` |
| SQL calls `capture_core43_shadow_inputs()` | yes (command pattern check, body intentionally not copied) |
| HTTP client command pattern | no |
| `postgres` can EXECUTE capture function | yes |
| `postgres` has USAGE on `public` | yes |

## Last 48 hours of cron.job_run_details

- Recorded executions: **24**
- Status `succeeded`: **24**
- Status `failed`: **0**
- Latest recorded start: **2026-11-16 20:25:00 UTC**, status `succeeded`.

These counts verify scheduler execution status, **not** how many prediction records were captured or whether every expected game was processed. The query does not disclose cron command bodies or credentials.

## Compatibility conclusion

The SECURITY-06 proposal revokes privileges from `PUBLIC`, `anon`, and `authenticated`, not from the job owner `postgres`. The job currently executes under `postgres` with explicit function execution privilege. On this evidence, that scoped revocation is **unlikely to break job 5 solely through the cron role's function EXECUTE permission**. This does not guarantee end-to-end behavior after migration; integration tests and post-change monitoring remain necessary.

## Remaining release blockers

- Complete frontend, edge function and external consumer inventory.
- Independently verify proposed migration and rollback in an equivalent isolated environment.
- Do not apply SECURITY-06 SQL, merge Draft PR #274, or deploy until explicit approval. **Production NO-GO remains.**
