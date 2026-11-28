# CAL-28W — offline signed key-rotation history

A synthetic Ed25519-signed append-only sequence records key bootstrapping and rotations. Each entry binds its sequence number, prior event hash, auditor identity, old/new key IDs and new key fingerprint. The verifier starts from an explicitly supplied checkpoint and rejects missing entries, forks, changed fingerprints, reused key IDs, unauthorized transitions and invalid signatures. Twelve synthetic regression tests are included in the CAL-04 CI workflow.

**Trust limitation:** The supplied checkpoint and authority key are NOT independently authenticated. An attacker who controls both can replace the complete history. The chain does not prove actual independent key custody, external timestamping, revocation publication or secure provider storage. Passing verification always returns `trusted:false`. This prototype does not change CAL-28V pin decisions or production CORE 4.2; it is not a live transparency log.

For a real deployment, independently pin the checkpoint and root key outside the writer's trust domain, cross-sign rotations, publish witnessed checkpoints, verify consistency across hosts and maintain independently distributed revocation history. No Supabase writes, merges, deployment or live dry-run.
