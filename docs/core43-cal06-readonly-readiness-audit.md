# CORE43-CAL-06 – Read-only readiness audit (2026-11-14)

Status: **NOT READY for live scheduled execution**. This is an audit, not authorization to merge or deploy.

## Verified in repository
- CAL-05 PR CI passed: two separate jobs uploaded and downloaded a mock ledger artifact, and duplicate detection passed.
- CAL-04 PR CI runs unit/integration tests; the actual `dry-run` job is skipped on `pull_request`.
- The workflow declares `schedule: */10 * * * *`, but GitHub scheduled workflows only execute from the repository default branch. A draft PR cannot activate this schedule.
- The scheduled runner calls the Supabase REST reader using `SUPABASE_SERVICE_ROLE_KEY`. The code path is intended to use GET requests, but this credential is **not read-only** and can bypass RLS. This is not least privilege.
- CAL-04 artifact restore selects the latest nonexpired artifact of a fixed name across repository runs, without filtering workflow ID, branch, or provenance.
- Ledger is only retained via a seven-day artifact. If no artifact is found, the collector starts with an empty ledger; this can lead to repeated keys after expiration/deletion.
- `gh api .../artifacts/{id}/zip > file.zip` is not exercised by the CAL-05 test, which instead uses official `actions/download-artifact`. Therefore the CAL-04 real restore path remains unverified.
- The time window is limited to upcoming games 45–75 minutes before puck drop; this is intentional but requires real-data observation.

## Required before live activation
1. Provision a database role/token with **SELECT-only** grants on the exact tables; do not use a service-role key for the scheduled collector. Validate with a negative write-permission test in a dedicated test environment.
2. Restore only artifacts belonging to the intended workflow and trusted default branch; test the exact production restore implementation, including corrupted ZIP and JSON handling.
3. Define a durable, read-only deduplication strategy across artifact expiry and missing runs; do not silently treat an expired ledger as a clean history.
4. Validate real-source completeness and timestamps in a manually authorized read-only run, with secrets scoped appropriately.
5. Keep CORE 4.2 production untouched, preserve PR #230 as Draft, and require explicit approval before merging or activating any schedule.

## Current decision
**NO-GO for real automatic scheduled collection.** Mock CI success is necessary but not sufficient for live operation. No Supabase mutations were performed during this audit.
