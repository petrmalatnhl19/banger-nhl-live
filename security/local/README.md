# SECURITY-09 — isolated, free local Postgres fixture

This is an **offline synthetic approximation**, not a clone of production Supabase or a complete RLS/API integration test. The Docker image is PostgreSQL 17; no Supabase keys, remote connection or production data are required. The container is bound to loopback only.

Prerequisites: Docker Engine/Desktop and Docker Compose. Run `docker compose version` and `docker compose up --help` to verify local CLI.

Run from the repository root:

```bash
bash security/local/verify.sh
```

The script creates a **local-only** synthetic database, checks the initial grants, applies the SECURITY-06 candidate to that local database, and asserts restricted/public access expectations. First run only: if you need to repeat from the initial state, use `cd security/local && docker compose down -v` (deletes **only this local fixture volume**), then run again.

**Not covered:** actual production view definitions, Supabase Data API, authenticated JWTs, real app consumers, edge functions, RLS policies beyond fixture, or service-role behavior. Do not apply this script to production or treat its passing as production authorization approval.

No deployment, merging or production SQL is performed.
