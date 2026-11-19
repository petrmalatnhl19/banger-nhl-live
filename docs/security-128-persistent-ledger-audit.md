# SECURITY-128 — Disposable persistent replay ledger

**Production status: NO-GO.** A local Node.js filesystem prototype persists accepted signed public snapshot digests and a monotonic timestamp in a disposable directory. No Supabase writes, migrations, production UI changes or deployment.

The prototype verifies SECURITY-126 Ed25519 signatures and freshness before entering a same-host exclusive directory lock. It rejects unknown/revoked keys, duplicate digests, non-increasing timestamps, lock contention and corrupt ledger contents. It writes a temporary file with exclusive creation, fsyncs it, atomically renames it and attempts a directory fsync. Tests cover restart, repeated acceptance, contention, tampering and corruption.

**Important limitations:** Not suitable for network filesystems, distributed replicas or long-lived production operation. Stale locks require an explicitly designed recovery protocol; current behavior fails closed. The file has no authenticated integrity protection, and an attacker with filesystem write privileges can rewrite its history. Timestamp-only monotonicity is a simplification; real feeds need scoped issuance sequence, signed audience/expiry and transactional persistence. Crash and multi-process concurrency tests are not comprehensive; a simulated held lock is not a full race stress test. The ledger grows without bound. The synthetic signer is not a trusted timestamp authority.

Next steps: design database transaction with unique digest, per-feed/game monotonic issuance sequence and atomic compare-and-set; concurrent-worker and crash recovery tests in a disposable DB; operational key rotation and revocation; production release gates in SECURITY-100. Keep PR #274 Draft and production unchanged.
