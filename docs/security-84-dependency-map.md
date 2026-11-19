# SECURITY-84 — Scoped dependency map

17 November 2026 · Draft PR #274 · **NO-GO**

Sources are SECURITY-78 tracked-source inventory, SECURITY-79/80 live catalogs, SECURITY-81 synthetic baseline checks, current rewrite/trigger/cron metadata, deployed Edge code and the checked-out frontend.

| Scoped object | Direct dependency or consumer | Indirect dependency / effect of proposal |
|---|---|---|
| `nhl_core43_shadow_inputs` | Predictions and preview views; capture routine; read-only shadow CLI and evidence diagnostics in source | Cron #5 calls capture as postgres. Cron #3 calls collector, whose CORE 4.2 timestamp patch can trigger capture on the archive. Preserve owner/service access and exercise both paths in isolation. |
| `core43_shadow_predictions_v1` | `index.html` loads `scripts/banger_tv_match_stats.js`, which queries this endpoint with a publishable key. | With permission denied, the TV panel keeps archive values and loses the verified experimental prediction. |
| `core43_shadow_preview_v1` | Same browser script directly requests preview and GSAx values. | Permission denied removes preview scores and GSAx from the TV panel. |
| `core43_shadow_readiness_v1` | Catalog shows archive, goalie snapshot and starter evidence dependencies. No runtime caller confirmed in source or the deployed Edge functions. | Restricting SELECT removes its public API contract if exposed. External use remains unknown. |
| `nhl_core42_status` | `core-performance.js` reads the status relation; the view reads the archive. | Keep SELECT for both public roles. Remove other table privileges on this view. |

Other verified paths: cron #4 calls finalize, which updates the archive without writing the trigger column. Cron #6 calls confirmed-evidence capture, which consumes identity/Rotowire/schedule metadata and writes starter evidence used by shadow capture and readiness. All four observed jobs are active and stored under `postgres`; this audit did not invoke them or inspect credentials in their command bodies. The public schedule projection, archive and three analytical views are outside the revocation scope.

Release blocker: TV Match Stats is a real source-level client. Its fallback prevents a panel failure but removes data. A release preserving current functionality needs a separately validated public projection or an equivalent safe data contract before removing these reads. Traffic and out-of-repository dependencies remain unverified.
