# CORE43-CAL-24 — operator-approved receiver pin advancement

The receiver runs `node scripts/core43_cal24_pin.cjs RECEIVER_PIN TRANSFER_JSON TRUSTED_PUBLIC_PEM WITNESS_ID OPERATOR_APPROVED_HEAD`. The receiver pin must already exist as `{"sequence":1,"head":"..."}` and be stored independently from the sender. The operator-approved head must be obtained through an independent trusted channel, not copied blindly from the sender's transfer. The command verifies the CAL-22 signed chain and matching operator approval before atomically replacing the local pin.

A directory lock prevents concurrent updates; temporary files are fsynced, renamed and the parent directory fsynced. A real abrupt process exit can leave a lock requiring manual inspection; never automatically delete it. Synthetic exception-injection tests cover before/after rename; they do not establish power-loss durability. An already confirmed transfer is idempotent.

This is offline prototype code, not a secure approval UI, independent witness, deployed multi-host protocol, or verified underlying archive. Do not expose the CLI to untrusted operators. No Supabase writes, production CORE 4.2 changes, merge or deployment.
