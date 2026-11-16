# SECURITY-46 — CORE 4.3 integration discovery and blocked gate

Date: 2026-11-16. Draft PR #274. Read-only code inspection only; no production DB, no scheduling, no deployment.

## Inspected real repository code

- `index.html` loads `engine-lab.js`, `core-performance.js` and `scripts/core43_verified_dashboard.js`.
- `engine-lab.js` is described in source as an **analytical model dashboard**, and consumes archived forecast records; its model comparisons are not a callable CORE 4.3 prediction engine.
- `core-performance.js` is a display/data-consumer module; it accesses Supabase REST for historical metrics. It is **not** an offline scoring implementation.
- `scripts/core43_verified_dashboard.js` contains `calculate(archive,schedules)` for **verified CORE 4.1/4.2 accuracy**, not CORE 4.3 inference.
- `docs/security-34-pregame-refresh-design.md` explicitly labels the refresh flow as **DESIGN ONLY** and says the prediction engine is not implemented by that proposal.

## Conclusion

**BLOCKED: no verified callable CORE 4.3 scoring entrypoint and input/output contract were established in the inspected files.** It would be misleading to substitute a toy scoring function and call it real CORE 4.3 integration. No SECURITY-46 model-integration test was added or claimed green.

## Required interface before integration

1. Identify the actual CORE 4.3 implementation, version/commit, execution environment and licensing/access rights. If the engine lives in Supabase functions or a separate draft PR, obtain its read-only source and precise entrypoint.
2. Provide a deterministic fixture for one game, original frozen input, later pregame evidence with independent source timestamps, and an immutable actual-start/status record.
3. Implement an isolated runner that passes exactly the cutoff-valid inputs to the **real** CORE 4.3 function, records its model version and output hash, and refuses post-cutoff evidence.
4. Compare original and refreshed versions without modifying originals. Verify deterministic reruns, changed goalie input, invalid evidence rejection, missing input behavior, and no postgame leakage.
5. Bind the verified output to SECURITY-45 signature format and test persistence/permissions in a separate synthetic environment.
6. Only after integration succeeds, perform prospective shadow validation; no historical backfill or production activation.

## Release decision

**NO-GO.** Security tests 35–45 are valuable infrastructure checks, but they do not establish CORE 4.3 predictive accuracy or real-engine integration. Keep PR #274 Draft. Do not merge, deploy, modify CORE 4.2, or write to production Supabase.
