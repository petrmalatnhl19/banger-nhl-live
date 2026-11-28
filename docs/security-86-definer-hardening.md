# SECURITY-86 — Privileged routines

The production catalog records four SECURITY DEFINER routines in `public`, owned by `postgres`. Their ACL permits owner and `service_role` EXECUTE; effective EXECUTE is false for `anon` and `authenticated`. Public roles lack CREATE in `public` per SECURITY-80. CAPTURE and trigger invocation paths remain privileged.

| Routine | Production search_path | Relevant behavior |
|---|---|---|
| `capture_core43_shadow_inputs()` | public | Qualified relation references; writes frozen shadow inputs from archive and time-bounded goalie/starter inputs. Cron #5 and archive trigger can call it. |
| `core43_capture_on_core42_insert()` | public | Archive trigger on first transition of the CORE 4.2 timestamp from NULL; calls the shadow capture routine. |
| `capture_core43_confirmed_evidence()` | public | Cron #6. Source reads qualified identity, schedule and Rotowire relations and writes qualified starter evidence. |
| `rls_auto_enable()` | pg_catalog | Event trigger routine. A separate DDL-trigger analysis would be needed for changing its configuration. |

The disposable test sets `search_path` to `pg_catalog, pg_temp` for the first two synthetic routines and exercises direct capture and archive-trigger capture after the revocation. Both paths captured two ready sides and repeat direct capture added zero rows. The explicit temporary schema position keeps it out of implicit first position. Production functions and their owners were left untouched. The starter-evidence routine, event trigger, managed role inheritance and production extension/operator resolution still need independent staging verification before any routine hardening. Keep that change separate from the five-object ACL proposal.
