# SECURITY-81 — Synthetic capture function privilege regression

Date: 2026-11-17. Draft PR #274. **Offline synthetic PostgreSQL only.**

New test: `security/local/security81-capture-function-privileges.sh`, run after the existing local PostgreSQL tests in `.github/workflows/security-local-postgres.yml`.

Assertions: the zero-argument `public.capture_core43_shadow_inputs()` exists, is owned by synthetic `security_local`, has SECURITY DEFINER enabled, has the currently observed `search_path=public` configuration, denies EXECUTE to `anon` and `authenticated`, grants EXECUTE to `service_role`, and denies public CREATE on schema `public`. It also attempts actual calls as the two unprivileged synthetic roles and requires failure. A transaction grants EXECUTE to `anon` temporarily, checks that the detector observes this unsafe state, then rolls back and checks the grant is gone.

**Important distinction:** This test locks the **observed baseline** `search_path=public`; it does not claim that this is the optimal hardened search path. The staging hardening proposal remains pending independent review of unqualified names, function/operator resolution, and compatibility. The synthetic owner `security_local` differs from production `postgres`. The local fixture is not a complete production privilege or API simulation.

No production SQL writes, no cron modification, no deployment or merge, no CORE 4.2 modification. **NO-GO**.
