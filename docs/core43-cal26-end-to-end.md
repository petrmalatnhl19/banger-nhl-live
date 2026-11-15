# CORE43-CAL-26 — integrated offline security regression

Run `node --test scripts/test_core43_cal26_end_to_end.cjs`.

This test composes the existing CAL-22, CAL-24 and CAL-25 implementations: verifies an Ed25519 signed transfer against the receiver's pinned history; requires a separately supplied approved head before atomic advancement; verifies the resulting receiver pin; checks idempotent replay; rejects unauthorized approvals and modified signatures; simulates a pre-rename exception; and checks that an orphaned lock triggers manual review and blocks updates.

All signing keys, archives and history entries are synthetic. This is an integration regression test on a single test runner, **not** independent-machine witnessing, real network transport, physical power-loss testing, or proof that underlying evidence archives are available. The approved head in tests is a fixture, not an independent approval service. No production CORE 4.2, Supabase writes, merges, deployment or live collection.
