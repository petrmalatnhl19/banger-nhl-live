# SECURITY-31 — read-only production CORE43 capture completeness audit

Date: 2026-11-16. Production Supabase project `app-development`. All SQL statements were SELECT-only. No capture function was invoked, no production data or grants were changed.

## Completeness and duplication

Archive eligibility uses the same time window as the inspected capture function: `core42_predicted_at >= 2026-11-08 00:00:00+00` and `<= now()`.

| Measure | Production result |
| --- | ---: |
| Eligible archive games | 56 |
| Distinct games with captured shadow inputs | 56 |
| Shadow rows | 112 |
| Duplicate `(game_id,side)` combinations | 0 |
| Missing expected away/home sides | 0 |
| Unexpected shadow sides relative to eligible archive games | 0 |
| Invalid/missing side values | 0 |
| Null prediction timestamps in shadow rows | 0 |

Expected-side audit used a cross join of eligible games with `away` and `home`, comparing each pair against shadow inputs; both missing and extra sets were empty.

## Readiness distribution

| Readiness | Rows |
| --- | ---: |
| `ready` | 14 |
| `missing_pregame_starter_evidence` | 88 |
| `missing_frozen_goalie_id` | 10 |
| **Total** | **112** |

The 98 non-ready rows reflect explicit readiness states, not missing capture records. This snapshot does not prove whether the starter evidence pipeline is complete or whether the goalie IDs were available at prediction time. Further investigation should preserve pre-prediction timestamp integrity.

## Release decision

**Capture coverage PASS for this point-in-time read-only snapshot; production security remediation remains NO-GO.** Completeness does not imply accuracy or absence of all operational faults. Do not merge PR #274, deploy, run capture, or change production grants without explicit approval.

Recommended SECURITY-32: investigate evidence availability and frozen goalie ID gaps, with read-only cohort/timestamp checks and no retrospective mutation of frozen predictions.
