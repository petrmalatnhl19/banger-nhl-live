# CAL-28Q — copy and commit boundary race audit

The CAL-24 receiver now records source directory device/inode/ctime before copy and checks it after copy, rejecting a replaced source. A final signed-evidence verification and directory identity comparison is performed immediately before the pin rename. Deterministic tests inject a same-content directory replacement at the copy boundary and tamper with archive evidence immediately before the final check; both must leave the receiver pin unchanged and remove lock and temporary pin files. The stable signed synthetic archive path must still advance.

## Remaining gaps

1. Recursive `cpSync` is path-based and can be raced between individual file opens; source inspection is not atomic and is not an OS snapshot.
2. A concurrent writer can mutate archive contents after the last verification and before/after rename. Additional checks reduce the exposure but cannot eliminate the final TOCTOU window.
3. Private copy permissions do not isolate from processes running with the same OS identity or elevated privileges.
4. Filesystem ctime and inode identity are not cryptographic immutability guarantees.
5. Real immutable storage, separate principals and platform-specific dirfd/openat or snapshot primitives require a distinct deployment/security design review before trusted use.

Synthetic/offline testing only. Production CORE 4.2 unchanged; no Supabase writes, merge or deployment.
