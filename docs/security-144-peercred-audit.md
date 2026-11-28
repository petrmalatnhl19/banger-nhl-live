# SECURITY-144 — Kernel peer-credential gate (offline)

**Prototype only, production NO-GO.** `security/local/security144-peercred-writer.py` obtains `SO_PEERCRED` on the **same accepted Linux Unix socket connection** before reading request bytes. An explicit nonempty allowlist of numeric UIDs is required. Unknown UIDs fail closed; only authorized peers can submit signed checkpoint/anchor envelopes to the SECURITY-140 transaction owner. The server owns trust keys and database path.

The offline Linux test runs signed requests from the runner UID and from `nobody` via `sudo -n`. It rejects signed requests from the unauthorized UID and accepts authorized signed epochs. It uses a deliberately accessible socket for the test and a private database directory. Failure to execute cross-UID checks is a test failure, not a skip.

**Limitations:** UID is not an application identity. Same-UID processes remain indistinguishable and may directly access files owned by that UID. `SO_PEERCRED` is Linux-specific; there is no portable fallback. Socket mode is permissive in this test only. No PID reuse mitigation beyond kernel credentials, peer lifecycle validation, user namespaces policy, systemd service isolation, independent trust witness, resource quotas, or production deployment design. Access control is a separate gate from cryptographic signature verification; both are required.

No Supabase access or changes, no production CORE/grants changes, no merge or deployment. PR #274 stays Draft.
