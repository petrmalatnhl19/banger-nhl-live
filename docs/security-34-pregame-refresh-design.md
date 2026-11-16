# SECURITY-34 — forward-only pregame CORE 4.3 refresh design (PROPOSAL ONLY)

Date: 2026-11-16. Draft PR #274, no production SQL or deployment. This is a design proposal, not an enabled scheduler or implemented prediction engine.

## Motivation

SECURITY-32 found 88 frozen sides missing pregame starter evidence. In 47 of them, evidence for the exact frozen goalie was published only after the original prediction (SECURITY-33: median 282.8 minutes, p90 610 minutes). Later evidence cannot be retroactively attached to the original frozen prediction.

## Principle: append-only versions, no hindsight

- Keep the existing CORE 4.2 archive, CORE 4.3 original shadow inputs and original prediction timestamps unchanged.
- Treat a refresh as a **new version** with independent `generated_at`, `input_cutoff_at`, `scheduled_start_at`, source evidence identifiers and immutable input hash. Do not overwrite original rows.
- Store both source publication and verification timestamps. Eligibility requires **both** timestamps <= `input_cutoff_at` and evidence ingestion timestamp <= `input_cutoff_at`; never infer availability from a later crawl.
- Require a trusted, timezone-aware game-start source and a conservative cutoff strictly **before actual puck drop**. If start time is missing, conflicting, postponed, or game status is live/final, **skip** refresh. Never create a post-start pregame prediction.
- Independently persist the cutoff and model version before evaluating outcomes; ensure any later scoring/backtest uses only pre-cutoff data.

## Candidate data model (not a migration)

A new append-only table, e.g. `core43_prediction_versions`, with:

- `id` UUID primary key, `game_id`, `version_kind` (original/pregame_refresh), `version_number` (monotonic per game), `model_version`.
- `scheduled_start_at`, `input_cutoff_at`, `generated_at`, `ingested_at`, `snapshot_hash`, `source_evidence_ids`, `source_timestamps`, `goalie_ids`, `readiness`, `prediction_payload`.
- Unique `(game_id,version_kind,input_cutoff_at,snapshot_hash)` for idempotency; a separate durable event ID or scheduler key prevents concurrent duplicate runs.
- Explicit `supersedes_version_id` only as metadata; **never update/delete** older versions.
- Minimal service-only permissions, RLS, scoped SECURITY DEFINER functions with schema-qualified references and safe `search_path`; no public direct write privileges.

## Proposed future process

1. Read current schedule and game status, compare source timestamps, and check source licensing/rate limits.
2. At configurable windows (candidate 90 and 30 minutes before scheduled puck drop, **not approved**), check whether a verified starter has become available. Do not assume scheduled time equals actual puck drop.
3. Under a transactional idempotency lock, build a new snapshot using only evidence known by the cutoff. Reject missing/late evidence and any game already live or started.
4. Generate and append a new prediction, immutable input hash and timestamp proof. Do not mutate CORE 4.2 or the original CORE 4.3 record.
5. Expose original vs refreshed versions explicitly in a separate test-only report. Never silently replace the displayed production favorite.
6. Backtest the versions independently against identical games and report sample size, coverage, calibration and MAE. No claimed accuracy gain without results.

## Failure and rollback behavior

- Missing or inconsistent timestamps, status ambiguity, API failures, source mismatch, duplicate jobs or time drift: skip and record a non-sensitive reason.
- No retry after confirmed puck drop; no backfill of old prediction versions.
- Feature flag defaults **OFF**; rollback means disabling future refresh creation, not rewriting historical snapshots.
- Monitor version counts, duplicate conflicts, refresh latency, starter coverage, skipped reasons and data provenance.

## Required acceptance tests in isolated PostgreSQL

1. Original prediction remains byte-for-byte unchanged after a refresh.
2. Evidence published or verified after cutoff is excluded, even if available by the time of test execution.
3. No refresh when live, final, postponed, or when start-time provenance is unreliable.
4. Duplicate/concurrent scheduler invocations produce at most one version for the same idempotency key.
5. A valid pregame confirmation creates one new immutable version; different valid cutoff creates a distinct version.
6. Anon/authenticated roles cannot read internal version payloads or write versions; authorized service role can run a scoped operation.
7. Failures leave no partial version; re-run is safe.
8. Scoring never uses outcomes or evidence after each version's cutoff.

## Release gate

**DESIGN ONLY / PRODUCTION NO-GO.** First verify actual schedule/start-time sources, complete external consumer inventory, build an isolated fixture and tests, and obtain explicit approval for any new production schema, job or frontend behavior. Do not merge or deploy Draft PR #274.
