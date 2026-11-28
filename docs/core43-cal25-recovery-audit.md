# CORE43-CAL-25 — read-only recovery audit

Run `node scripts/core43_cal25_audit.cjs RECEIVER_PIN`. This **read-only** check validates the receiver pin shape and flags missing/corrupted pins, symbolic links, existing lock directories and leftover `.next-*` files. On any finding, it exits nonzero and requires manual review. It never deletes stale locks, accepts a sender-provided pin, or repairs a damaged file.

This is a diagnostic only, not an authorization to advance a pin or proof that the ledger/archive exists and matches the pin. A successful result is a local consistency check, not evidence of independent witnessing or real power-loss durability. Synthetic tests run with `node --test scripts/test_core43_cal25_audit.cjs`. Production CORE 4.2, Supabase, deployment and live collection remain untouched.
