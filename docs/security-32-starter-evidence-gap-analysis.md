# SECURITY-32 — pregame starter evidence gap analysis

Date: 2026-11-16. Production Supabase `app-development`, **SELECT-only** queries. No prediction/evidence mutation or retrospective backfill.

## Frozen shadow input readiness snapshot

From SECURITY-31: 112 total sides: 14 `ready`, 88 `missing_pregame_starter_evidence`, 10 `missing_frozen_goalie_id`.

## Breakdown of 88 missing pregame starter evidence rows

For each frozen `(game_id, team_code, goalie_id)`, joined to `nhl_core43_starter_evidence` and compared `source_published_at` and `verified_at` to frozen `prediction_at`:

| Mutually exclusive category | Sides |
| --- | ---: |
| Exact goalie evidence exists, but only after prediction | 47 |
| No exact goalie evidence; some evidence exists for another goalie on same game/team | 18 |
| No evidence exists for that game/team | 23 |
| **Total** | **88** |

- Of the 47 exact goalie matches, all 47 have earliest source publication **after** prediction and earliest verification **after** prediction.
- Exact goalie evidence valid by both timestamps at or before prediction: **0 of 88**.
- Missing goalie IDs in this 88-row cohort: **0**; the 10 `missing_frozen_goalie_id` rows are a separate cohort.

## Interpretation

This supports the frozen-time guard: later confirmations must not be retrospectively used as if known at prediction time. It does not identify whether the root cause is upstream feed latency, prediction scheduling, source availability, or mapping mismatch; further diagnostics are needed. Do not alter immutable historical snapshots.

## Recommended next audit

SECURITY-33: analyze source publication/verification latency relative to prediction, stratify evidence-source coverage and goalie mismatches, then propose **forward-looking** improvements with no mutation of historical frozen inputs. Production security remediation remains **NO-GO**, PR #274 stays Draft.
