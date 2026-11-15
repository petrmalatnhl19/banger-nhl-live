# CORE43-CAL-08 offline export receiver

The receiver accepts the [CAL-07 signed export](core43-cal07-signed-pregame-export.md) as two files on a trusted host. It consumes no network or Supabase credentials. The PR workflow supplies synthetic files and ephemeral test keys only. Live collection remains disabled.

## Receive one bundle

Use Node.js 22 with its built-in SQLite module on a POSIX host. Run the receiver as the operating account that owns the ledger. Use a persistent local filesystem with SQLite locking and sync support. Store the ledger in a directory accessible only to that account. Pin the Ed25519 public key, source name and key ID outside the incoming directory.

```bash
mkdir -m 700 ./cal08-state

# One deliberate first run after confirming no previous ledger exists.
node --experimental-sqlite scripts/core43_cal08_receiver.cjs init \
  ./cal08-state/ledger.sqlite banger-local-fixture

node --experimental-sqlite scripts/core43_cal08_receiver.cjs receive \
  ./cal08-state/ledger.sqlite ./bundle.json ./bundle.sig \
  ./trusted-publisher.pem banger-local-fixture fixture-v1
```

`bundle.sig` is the detached 64-byte binary signature. Wait until both immutable files are present before calling the receiver. The receiver bounds file reads, rejects symlinks and non-regular inputs, and verifies the pair through the CAL-07 validator. The validator checks the pinned signer and source, the five-minute age limit, the pregame window, and the exact 30-column contract across the five tables. A partial publication or mismatched pair fails verification. The CLI prints a status or a redacted error code. The module returns the receipt when a game is accepted or duplicated.

## History and duplicate handling

- Initialization uses exclusive file creation. A missing history during reception is an error. A damaged file, unexpected format or version, or mismatched source blocks processing. The source binding permits key rotation through trusted configuration without resetting the ledger.
- A SQLite transaction obtains the write lock before evaluating expiry. An accepted game stores the bundle hash, acceptance time and all four variant keys, hashes and scores in one receipt. Source rows, names and credentials are excluded from the receipt. The unique key is the game ID and canonical kickoff instant within the fixed CAL-03 60-minute window. This covers re-signed exports with new hashes. An actual kickoff change remains a distinct capture. Rejected or incomplete evidence creates no receipt.
- Competing processes serialize on the same ledger. A retry returns the original receipt when its incoming package still passes validation. Commit precedes the response. If the process stops before commit, SQLite rolls the transaction back. If it stops after commit, the accepted receipt remains in the ledger. A lock timeout or storage error stops the current attempt.
- Protect the state directory and backups with the same owner-only access. Use a SQLite-consistent backup, or stop all writers and verify database integrity before copying. Loss or rollback to a valid but older copy can remove recent receipts. Recovery must confirm the backup covers the last accepted capture, or reconcile missing receipts from a trusted record before reception resumes. The local receiver cannot detect deliberate replacement by another valid copy of the same database.

## Activation boundary

The offline receipt database coordinates processes on one host. Delivery across hosts would require an approved producer, private storage with read-only consumer access, independently provisioned public keys, and a durable single-writer or transactional shared ledger. Ephemeral runner disks and expiring workflow artifacts do not supply that durability. These remain infrastructure decisions. The Supabase migration and its `pg_net` block are unaffected.

Local regression and integration tests use `node --experimental-sqlite --test scripts/test_core43_cal07_export.cjs scripts/test_core43_cal08_receiver.cjs`. They exercise separate CLI processes, corrupted and forged input, every required column, retries after write failure, and missing or invalid history.

References [Node.js SQLite API](https://nodejs.org/docs/latest-v22.x/api/sqlite.html) and [SQLite transaction behavior](https://www.sqlite.org/lang_transaction.html).
