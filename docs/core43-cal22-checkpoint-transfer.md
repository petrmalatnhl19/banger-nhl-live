# CORE43-CAL-22 — offline transfer of signed checkpoints

CAL-22 verifies a portable JSON object containing `schema: "core43_cal22_transfer_v1"`, `ledger` (the complete CAL-19 chain) and `checkpoint` (the CAL-21 Ed25519 signed checkpoint). The **receiving machine** independently supplies the trusted witness public key, expected witness ID and an externally pinned anchor `{"sequence":N,"head":"64 lowercase hex characters"}`. The sender must not supply or replace these trust anchors.

```bash
node scripts/core43_cal22_transfer.cjs transfer.json trusted-witness.pem witness-offline-1 trusted-anchor.json
node --test scripts/test_core43_cal22_transfer.cjs
```

The verifier checks that the transferred ledger contains the receiver's exact pinned prefix, verifies the full hash chain and signed final checkpoint, and rejects truncated history, forks, altered records, wrong signers and wrong witnesses. Replays of the identical checkpoint are accepted as idempotent and do not advance the anchor; callers must update the pinned anchor only via their separately authorized durable procedure.

**Scope limits:** This is an offline transfer format and verification prototype, not a live two-computer deployment or secure network transport. It does not transfer or revalidate the underlying CAL-18B evidence files, guarantee external witness independence, establish timestamp freshness, or independently pin the new head. A ledger plus signed checkpoint alone cannot prove the archive contents remain present. No production writes, Supabase access, deployment or changes to CORE 4.2.
