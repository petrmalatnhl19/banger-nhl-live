# SECURITY-33 — read-only starter evidence publication delay audit

Date: 2026-11-16. Production Supabase `app-development`; SELECT-only queries, no changes.

## Cohort

47 of the 88 frozen `missing_pregame_starter_evidence` sides have an eventual exact `(game_id,team_code,goalie_id)` evidence match. For each side, select the earliest `source_published_at` evidence and compare against frozen `prediction_at`.

| Metric | Result |
| --- | --- |
| Matching sides | 47 |
| Source of earliest matching evidence | RotoWire, all 47 |
| Mean source publication delay after prediction | 328.0 minutes (5h 28m) |
| Median publication delay | 282.8 minutes (4h 43m) |
| P90 publication delay | 610.0 minutes (10h 10m) |
| Minimum | 6m 12.8s |
| Maximum | 11h 21m 41.0s |
| Mean verification minus publication timestamp | 0.3 minutes |

## Delay bands

| Delay after frozen prediction | Sides |
| --- | ---: |
| Up to 1 hour | 1 |
| Over 1, up to 3 hours | 8 |
| Over 3, up to 6 hours | 25 |
| Over 6 hours | 13 |
| **Total** | **47** |

## Interpretation and limitations

This cohort suggests later **source publication**, rather than large downstream verification delay, is the principal timing gap for these 47 cases. It does **not** prove RotoWire was the earliest possible external source, or that all 88 cases share this cause. The remaining 41 cases comprise 18 with evidence for a different goalie and 23 with no evidence for the game/team; those require separate investigation.

**Never backfill later evidence into immutable historical predictions.** For future model versions, consider an independently timestamped pregame refresh close to puck drop, retaining both original and later prediction timestamps and avoiding hindsight leakage. Confirm actual game-start times, rate limits, source availability and model policy before designing that refresh.

Production security remediation remains **NO-GO**. Draft PR #274 stays unmerged; no deployment, SQL mutation, or scheduler change was performed.
