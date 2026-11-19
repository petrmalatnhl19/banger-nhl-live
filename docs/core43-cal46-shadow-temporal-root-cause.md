# CORE43-CAL-46 — Root cause: immutable T−12h shadow snapshot vs later confirmed starters

Audit 2026-11-17 ~20:46 UTC, game 2026020335, Draft PR #230, starting HEAD `9024f0e1f47b929aeefffe38bfc28c8ede6342bc`. Read-only SQL only. No production change.

## Confirmed root cause

The two `nhl_core43_shadow_inputs` rows are **point-in-time capture records**, not automatically recomputed readiness:

| Side | prediction_at (UTC) | captured_at (UTC) | gsax_fetched_at (UTC) | starter fields | readiness |
|---|---|---|---|---|---|
| EDM | 2026-11-17 12:15:12.367 | 2026-11-17 12:15:12.419578 | 2026-11-17 09:26:35.129504 | status/published/verified NULL | missing_pregame_starter_evidence |
| FLA | 2026-11-17 12:15:12.367 | 2026-11-17 12:15:12.419578 | 2026-11-17 09:26:35.129504 | status/published/verified NULL | missing_pregame_starter_evidence |

For both matching game/team/goalie IDs, `nhl_core43_starter_evidence` later has `confirmed`, `source_published_at=2026-11-17 19:59:53.572942Z`, `verified_at=2026-11-17 19:59:53.654905Z`. The later evidence **cannot be retroactively included** in a capture timestamped 12:15 UTC. Thus `core43_confirmed_goalie_matchups` can currently be ready while `core43_shadow_predictions_v1` remains 0/2, because the latter counts the frozen rows with `readiness='ready'`. This is expected temporal separation, not proof of a stuck refresh.

## Correct remediation proposal (offline only)

1. Preserve original `nhl_prediction_archive` CORE 4.2 and both `nhl_core43_shadow_inputs` rows unchanged. Never UPDATE readiness, starter timestamps, or original prediction timestamp.
2. Define an **append-only, separate** experimental revision/capture record for a new `asOf` after independently confirmed starter evidence, but still before kickoff and within authorized CAL-07 T−75/T−45 window. Record explicit `revision_kind`, `source_prediction_at`, `predicted_at`, `kickoff_at`, evidence publication/verification timestamps, snapshot IDs/hashes, exact model version and GSAx source timestamps.
3. Require both evidence records to have `source_published_at <= verified_at <= asOf < kickoff_at`; goalie IDs and team codes must match, and GSAx snapshot `fetched_at <= asOf`, shots >= 30. If source evidence is stale or ambiguous, fail closed.
4. Do not call later revision a CORE 4.2 original prediction or compare it as if generated at T−12h. Compare models only at equivalent as-of time and same available evidence. Mark any later experimental result distinctly.
5. Require separately authorized CAL-06 read-only export access and verifiable Ed25519 signature, digest and issuedAt; no service-role substitution, no bypass of RLS. If not proven, `NOT_READY` and no export.
6. Add offline tests in a future reviewed implementation for: evidence after capture rejected; evidence before new asOf accepted; source published after verified rejected; after-kickoff rejected; mismatched game/team/goalie rejected; stale/missing GSAx rejected; duplicate/ambiguous evidence rejected; original frozen rows unchanged.

## Status / scope

Root cause **verified by row timestamps**. Proposal is documentation only; no code patch or automated tests in this CAL-46 commit. The production pipeline was not modified. Future code implementation requires identifying the existing writer and explicit approval; do not invent a retroactive writer or run a production migration. At the T−75/T−45 checkpoint, check both confirmation and CAL-07 export authority independently.
