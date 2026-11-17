# SECURITY-142 — Offline isolated SQLite writer prototype

**Production NO-GO.** `security/local/security142-isolated-writer.py` introduces a Unix-domain socket listener with a private (0700) socket directory and socket mode 0600. The server owns the SQLite database path and trusted public-key registry; clients may submit only a fixed six-field signed checkpoint/anchor envelope. It delegates Ed25519 verification, binding checks and monotonic SQLite transactions to SECURITY-140. Malformed framing, client-supplied DB paths or key overrides, tampering and replay are rejected.

`.github/scripts/test-security-142-isolated-writer.py` uses synthetic ephemeral keys, a separate server process and disposable SQLite database. It exercises valid signed epochs, replay, bad anchor, injected DB path/key registry, socket permissions, and intentionally demonstrates that a same-UID process can still modify the SQLite file directly.

**Limitations:** This is only an isolated process, **not an OS-enforced privileged writer**. Socket permissions alone cannot isolate clients sharing the same UID; the SQLite file is writable by that UID. No `SO_PEERCRED` client authentication, service-manager sandbox, privilege separation, independent trust registry/anchor pin, hardened socket lifecycle, resource quotas or durable witness. The listener handles one request at a time and is a test harness, not a production daemon. A trusted service identity and filesystem ACLs must be designed before claiming bypass prevention.

No Supabase access, grants/CORE changes, deployment or merge. PR #274 remains Draft.
