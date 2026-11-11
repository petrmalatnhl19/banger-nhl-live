# Experimental CORE 4.3 append-only capture archive

PR #115 introduces a **disabled-by-default** server-only insert-once writer and review-only SQL for a dedicated experimental table. It is NOT deployed, scheduled, or wired to live automatic capture. The writer checks capture digest, chronology, source archive ID, and experimental-only flags. A unique key rejects duplicates; the proposed database trigger rejects updates/deletes and RLS excludes browser roles.

Before enabling: review/apply the DDL using the project's normal migration workflow, verify server-side clock enforcement and credentials, verify real scheduled monitor runs, then connect a separately tested job that creates a prospective capture and calls `insertOnce({enabled:true,...})`. Do not claim an archived prediction merely because the read-only monitor returned `ready:true`.

A known caveat: the timestamp fields are client supplied; the proposed table checks `archived_at` against `frozen_at` and kickoff, but independent source provenance and real end-to-end tests remain necessary before accuracy reporting.
