# SECURITY-35 — offline immutable pregame refresh prototype

Date: 2026-11-16. Draft PR #274 only. **Not production implementation.**

## Files

- `.github/scripts/test-security-35-pregame-refresh.py`: deterministic in-memory SQLite reference prototype with eight unit tests.
- `.github/workflows/security-grants-offline.yml`: now executes this script after the existing grants proposal check.

## Covered invariants

1. Valid refresh appends a new version and preserves the original prediction row unchanged.
2. Evidence published after the cutoff is rejected.
3. Evidence verified after the cutoff is rejected.
4. Evidence ingested after the cutoff is rejected.
5. Live/final/postponed and post-start refreshes are rejected.
6. Missing timezone-aware start provenance is rejected.
7. Repeated identical refresh is idempotent.
8. A later valid cutoff creates a separate version; no eligible evidence produces no row.

## Limitations and release gate

- Uses SQLite in memory, not PostgreSQL or Supabase, and does not implement real model scoring, trusted game status, role permissions, concurrent workers or external source integrations.
- The supplied `start` is assumed trustworthy by this prototype; real-world schedule and actual puck-drop validation are future work.
- Eight tests are present, but CI green status must be verified separately on the latest commit.
- **Production NO-GO**. No production schema changes, cron modifications, frontend changes, merges or deployments. PR #274 remains Draft.

Next: verify CI and, if green, add an isolated PostgreSQL implementation with transaction/concurrency and privilege tests before any rollout discussion.
