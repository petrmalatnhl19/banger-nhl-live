# DATA-14.9 — Integration readiness audit

Date: 2026-11-20. Scope: read-only review of Draft PR #379 and committed CI status.

## Verified
- PR head f20f2f816335920fcdce2348213b1dbf8617c7e8: Frontend smoke checks completed successfully.
- PR remains Draft.
- GitHub reports mergeable=false. main and PR diverged (23 commits ahead, 8 behind), requiring explicit conflict review and synchronization before any merge.
- Existing production NHL collector was not modified by DATA-14.

## Current capabilities
- Offline coverage and recovery diagnostics.
- Permission-aware candidate gate (fail closed without explicit source policy).
- Offline adapter for hypothetically licensed providers, 36h timestamp window, team/game identity, 4 forward lines, 3 defense pairs, duplicate detection, rosterValidated flag.
- Offline dry-run selection that never changes an existing source.
- CI regression suites for freshness, permission, readiness, adapter, dry-run, and integrated adversarial cases.

## Open blockers / quality gaps
1. **Merge conflict:** main moved independently. Resolve carefully; do not overwrite unrelated workflow changes.
2. **No real licensed alternative provider:** no permission or approved endpoint verified. Adapter is intentionally disconnected.
3. **Untrusted validation flags:** adapter currently trusts caller-supplied rosterValidated and gameId. Before production use, independently validate player identities against the official roster and gameId/team/opponent against the NHL schedule.
4. **Freshness:** timestamps are checked but provider claims are not independently authenticated; no conflict arbitration across providers.
5. **Permission:** configuration flags alone do not prove legal rights; verify actual provider contract and redistribution terms.
6. **Coverage counters:** freshness and incomplete-group reasons are prioritized mutually exclusively in data_14_lineup_freshness_audit.py; overlapping issues can be undercounted. Fix independent metrics before relying on report totals.
7. **No actual next-game confirmation:** do not equate recent projections with confirmed starters or played lineups.

## Release gate
Keep Draft; do not merge, deploy, publish third-party content or modify Supabase. First reconcile branch with main, fix independent coverage metrics and verify CI. Then implement independent roster/schedule validation and obtain a provider-specific license before enabling ingestion.
