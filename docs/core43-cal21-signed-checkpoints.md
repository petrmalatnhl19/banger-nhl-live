# CORE43-CAL-21 — offline witness checkpoint verification

CAL-21 introduces an offline Ed25519 signature verifier for a checkpoint bound to the **entire** CAL-19 ledger head and sequence. Checkpoint JSON fields are exactly `schema`, `sequence`, `head`, `witnessId`, `signature`. Signature input is UTF-8 JSON array `["core43_cal21_checkpoint_v1", sequence, head, witnessId]`. The public key, expected witness identity, minimum previously confirmed sequence and (if available) externally pinned head **must be independently trusted inputs**.

```bash
node scripts/core43_cal21_checkpoint.cjs ./ledger.jsonl ./checkpoint.json ./trusted-witness-public.pem offline-witness-01 42 <EXTERNALLY_PINNED_HEAD>
node --test scripts/test_core43_cal21_checkpoint.cjs
```

The verifier rejects wrong keys, changed payloads, unsupported key algorithms, missing ledger entries, sequence rollback and mismatched pinned heads. Test keys are ephemeral and generated locally in the test process; no private key is committed or exported.

**Security boundary:** This proves only that a holder of the trusted Ed25519 key signed the checkpoint bytes. It does not prove independent witness operation, key custody, timestamp authenticity, revocation status, trusted checkpoint freshness, or immutability of external pins. Minimum sequence alone cannot detect a replacement with a different head at the same sequence; pin the exact previously trusted head or use an externally verified monotonic checkpoint service. No live collection, production writes, Supabase operations, merge or deployment.
