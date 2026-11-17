# SECURITY-94 — Exact TV Match Stats field lineage (source-level)

17 November 2026 · Draft PR #274 · **NO-GO / read-only inventory**

## Verified active browser consumer

The tracked browser script `scripts/banger_tv_match_stats.js` is loaded by `index.html` (see SECURITY-84). It uses the Supabase REST gateway with a publishable client key, fetching three datasets concurrently. It catches HTTP errors for the two experimental views and replaces their rows with empty arrays, which means the UI displays dashes for unavailable numbers.

| REST resource | Query columns in the actual script | Selection | UI usage |
|---|---|---|---|
| `nhl_prediction_archive` | `game_id,game_date,away_team,home_team,status,core41_away,core41_home,core42_away,core42_home,advanced_away,advanced_home,experimental_away,experimental_home` | `status=eq.pending&order=game_date.asc&limit=40` | Dropdown, CORE 4.1, CORE 3.1, xG, fallback CORE 4.2 |
| `core43_shadow_predictions_v1` | `game_id,core42_away,core42_home,core43_away,core43_home,experiment_status` | `limit=100` | CORE 4.2 override and CORE 4.3 verified score; `experiment_status` is requested but **not rendered** by this script |
| `core43_shadow_preview_v1` | `game_id,core43_preview_away,core43_preview_home,away_gsax_per100,home_gsax_per100,preview_status` | `limit=100` | CORE 4.3 preview and away/home GSAx/100; `preview_status` is requested but **not rendered** by this script |

Rows are joined in JavaScript by `String(game_id)`; the dropdown is driven solely by pending archive rows. The script makes no per-game filters on either experimental view, fetching up to 100 rows each. It does not currently validate `experiment_status` or `preview_status` before showing numerical values. A future public contract should define what “verified” and “preview” mean, and must not silently relabel experimental output as validated.

## Candidate minimal public output (requires approval)

For this one consumer, the displayed experimental fields are `game_id,core42_away,core42_home,core43_away,core43_home,core43_preview_away,core43_preview_home,away_gsax_per100,home_gsax_per100`. `experiment_status` and `preview_status` are not displayed, but may be necessary server-side for eligibility filtering. This is **not** a final approved public allowlist and does not prove that all these values are safe to publish.

A separate versioned public projection should filter eligible games and permitted fields server-side, limit row scope and exposure, and ensure that source snapshots and internal readiness fields remain private. Retain the current archive behavior and CORE 4.2 fallback. Avoid changing the public script until a synthetic gateway and browser regression prove equivalent display.

## Verified gaps and next test

- Catalog ACL checks and SECURITY-88 establish that full revocation breaks this consumer; no real production REST requests were made here.
- Check view SQL definitions, dependencies and data classification before choosing a publication implementation.
- Check if any external consumer needs `experiment_status` or `preview_status` and whether filtering by pending games is sufficient.
- Test both `anon` and `authenticated`, RLS boundaries, private-field denial, service capture and exact ACL rollback against isolated PostgREST.
- Verify real rendered values, status semantics, and freshness in synthetic end-to-end tests. Green current CI does not clear the release gate.

**No production SQL, frontend changes, release, or merge.**
