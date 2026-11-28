# CORE43-CAL-10 offline chain integration

The test harness connects the existing [CAL-07 export contract](core43-cal07-signed-pregame-export.md), [CAL-08 receiver](core43-cal08-offline-receiver.md) and [CAL-09 ledger transfer](core43-cal09-ledger-transfer.md). The fixture producer signs separate pregame exports for synthetic Dallas–New York Rangers, Boston–Buffalo and Seattle–Vancouver matchups. Each has its own game ID, kickoff, baseline and goalie data. A directory rename simulates publication of a complete payload and signature pair. Each receive attempt starts a fresh process with an empty local workspace and retrieves signed evidence from the same local SQLite coordinator.

| Scenario | Assertions |
| --- | --- |
| Three independent exports and a reissue | Three committed generations link to their predecessors. Recovery restores all 12 variant records with the exact keys, coefficients, scores and digests reported by the original workers. A signed reissue returns the original receipt without advancing history. |
| Interrupted or corrupt delivery | Missing delivery, missing signature, forged signature, truncated payload and expiry leave history unchanged. Delivery of a complete, valid export inside the allowed time window succeeds. |
| Lost authority write or reply | Failure while publishing after local acceptance preserves the previous head and all of its variants. Interruption after commit but before acknowledgement leaves the receipt recoverable. A fresh worker returns the committed receipt on retry. |
| Stale or damaged history | Recovery rejects a previously valid signed snapshot against a newer authoritative head, and rejects truncated SQLite bytes. A failed restore leaves the destination absent. The verified latest snapshot restores both games and all their variants. |

Run the integrated tests with Node.js 22.

```bash
node --experimental-sqlite --test scripts/test_core43_cal07_export.cjs \
  scripts/test_core43_cal08_receiver.cjs scripts/test_core43_cal09_transfer.cjs \
  scripts/test_core43_cal10_chain.cjs
```

The simulated export producer, workspaces and coordinator all run on one host. Production use still needs an approved read-only export source, private delivery, a durable strongly consistent coordinator, protected signing keys and an independent checkpoint for disaster recovery. The PR workflow uses synthetic data and does not enable the live job.
