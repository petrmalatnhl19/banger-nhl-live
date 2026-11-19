# CAL-28R — independently controlled immutable archive design (offline proposal)

## Threat model

The current receiver and source archive can be modified by another process with equivalent OS permissions. Repeated signature checks, file-descriptor reads, private copies, and directory identity checks do not close the final time-of-check/time-of-use gap. The receiver must not assume local files are immutable.

## Proposed independent trust boundary

1. Archive publisher runs under a distinct write principal in a separate security domain/account. The receiver has only read permission and cannot disable retention, overwrite, or delete evidence.
2. Publish immutable digest-addressed objects to a store with enforced compliance-mode retention/WORM and separately controlled administrative privileges. Verify real provider retention settings and effective permissions through an independently authenticated read-only audit; do not trust a JSON assertion.
3. Pin an externally audited object version/identifier and digest, with independently signed receipt and checkpoint. Validate all bytes, RFC3161 TSA chain, and official game-start evidence before receiver approval.
4. Separate archive publisher, receiver, independent auditor and key-management credentials; audit rotation, revocation, retention expiry, outages and recovery. Do not put administrative archive credentials in GitHub Actions.
5. Define explicit operational gates: no trusted archive evidence => no pin advancement; no verified independent attestation => no pilot. Verify using a separate security principal and independent infrastructure.

## Offline implementation scope

`core43_cal28r_archive_policy.cjs` validates a minimal policy *shape* and rejects missing digest binding, shared principals, non-compliance retention and absent claimed audit fields. Even a passing policy returns `trusted:false`: self-declared booleans cannot prove object lock, identity separation or immutability. The module is deliberately **not wired into the receiver** and does not enable a production path. No external store was provisioned, no real credentials accessed, and no external attestations collected.

## Remaining blockers

External store/provider selection, cost/retention review, actual immutable versioned object API, out-of-band proof of permissions and retention, independent timestamp authority, operator authorization, and a full end-to-end adversarial pilot remain open. No Supabase writes, CORE 4.2 changes, deployment or merge.
