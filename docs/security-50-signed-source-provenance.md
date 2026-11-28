# SECURITY-50 — signed pregame source provenance (offline)

## Scope
New `scripts/test_security50_signed_source_provenance.cjs` uses synthetic source observations, an ephemeral Ed25519 signing key and an explicit public verification key. It tests cryptographic binding of the source observation and receipt envelope, expected game identity, chronology, as-of cutoff, wrong key, forged signature, and post-cutoff evidence. Successful verified evidence is linked by SHA-256 to an offline nonpersistable receipt. Wired to `security-grants-offline.yml`.

## Critical trust limitation
The test signer is a locally generated fixture, **not an NHL, RotoWire, MoneyPuck or other independent data publisher**. An internally generated signature proves only integrity relative to that key; it does not independently establish original publication time or that the data actually existed before cutoff. An attacker controlling the signer could backdate all timestamps. External trusted timestamp / authenticated publisher metadata, custody chain, independently pinned public keys and validated source authority remain necessary. This test is a provenance-contract exercise, **not real-world provenance verification**.

No Supabase access or writes, no scheduling, no deployment, no modification of production CORE 4.2, and no merging. **Release gate NO-GO.**
