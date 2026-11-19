# CAL-28H — migration to verified synthetic RFC3161 evidence

Introduced `scripts/fixtures/core43_cal28_signed_archive.cjs` to generate a synthetic signed CAL-18B RFC3161 archive, a matching CAL-19 ledger entry, a signed CAL-21/22 transfer, and a receiver pin. Reused it in CAL-28G and added a CAL-24 positive/replay test using `archiveRoot`.

This is the **first migration increment**, not completion. Existing CAL-24, CAL-26 and CAL-28 synthetic digest tests still exercise the legacy ungated `advancePin` JavaScript path. That bypass must not be considered closed. Before enforcing archive evidence unconditionally, migrate the remaining legacy tests, preserve crash and approval failure coverage, then remove the signature-only fallback in CAL-24. The test authority is ephemeral and **not** an independent production TSA. No production changes or Supabase writes.
