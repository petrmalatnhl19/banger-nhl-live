# CORE43-CAL-09 ledger transfer

Offline transfer for the [CAL-08 SQLite ledger](core43-cal08-offline-receiver.md). Separate worker processes use private workspaces and a local SQLite authority that simulates a persistent coordinator. The prototype uses no remote storage, hosted credentials or external database. CI uses ephemeral signing keys and synthetic exports. Live collection remains disabled.

## Transfer protocol

1. Explicitly initialize the authority once with an empty CAL-08 ledger. Pin the ledger ID, producer source name and snapshot verification key outside the download path. The bundle publisher's Ed25519 key and the ledger signing key serve different purposes.
2. The worker reads the authority's current generation and manifest SHA-256, together with the referenced snapshot. The transferable files are a UTF-8 JSON manifest, a detached 64-byte signature and up to 16 MiB of SQLite bytes. The manifest binds the ledger ID, source, format, SQLite schema version, generation, previous manifest digest and SHA-256 of the snapshot. Sign the format identifier `core43_cal09_ledger_v1`, one zero byte and the exact manifest bytes with Ed25519.
3. Restore only a snapshot that matches **both** the expected generation and digest returned by the trusted authority. Verify the pinned signature and SQLite SHA-256 before opening the snapshot. Then verify SQLite integrity, application ID, version, exact table definitions, source and the four coefficient records in every receipt. Publish the file atomically to a new path in the private worker workspace. A valid earlier signature does not authorize rollback against a newer head.
4. Process the incoming export through the CAL-08 receiver against the restored copy. Duplicate or incomplete input needs no new generation. For newly accepted evidence, use SQLite's `VACUUM INTO` to produce a consistent standalone snapshot without copying an active journal. Sign it with the next generation and the previous head's digest.
5. Commit the new head and its signed snapshot together using compare-and-swap on the previous generation and digest. Return acceptance only after that commit. A competing update discards the temporary candidate, reloads the committed head and recalculates against it. After three conflicts the attempt returns an error. Lost replies can be retried with a still-valid export, or the operator can recover the original receipt from the committed snapshot after the export expires.

The coordinator treats game ID and canonical kickoff time as the CAL-08 capture identity. All four variants are part of the same receipt and transfer. A replay does not advance the generation. A newly rescheduled kickoff is a distinct capture.

## Run the offline verification

```bash
node --experimental-sqlite --test scripts/test_core43_cal09_transfer.cjs
```

The tests cover transfer into a separate workspace, an old signed bundle, modified contents, a forged signature, ledger identity mismatch, unsupported schema version, unexpected SQLite schema, missing variants, duplicate and distinct concurrent games, an aborted coordinator update and process interruption on either side of the commit. The workers run as separate processes on one machine. Separate workspaces simulate the filesystem isolation of distinct machines.

## Infrastructure and recovery boundary

Production would require a strongly consistent authority that supports conditional commits, a durable private snapshot store, restricted worker identities and a protected signing service. If head and snapshot live in separate systems, upload the immutable snapshot first, verify its availability and then conditionally advance the head. Readers must fetch the head directly from the authority and match the downloaded snapshot to it. Unreferenced snapshots can expire separately. Do not use a worker's cached head or an uploaded bundle as the authority.

The integrity guarantee assumes the head authority is trusted and current. Rolling back the **entire authority** to a valid older backup defeats a generation check that reads only that authority. Retain an independent monotonic checkpoint or audit record for disaster recovery. Reconcile the last confirmed generation and digest against it before accepting more exports. Loss of the authoritative head blocks operation. The offline prototype does not implement a remote coordinator, key custody, encryption in transit or a recovery witness.

References [SQLite VACUUM snapshots](https://www.sqlite.org/lang_vacuum.html) and [SQLite transaction behavior](https://www.sqlite.org/lang_transaction.html).
