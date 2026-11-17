# SECURITY-115 — TV public data completeness and freshness gate (offline)

Status: **NO-GO for production cutover**. This is a source-code contract audit, **not** evidence that a real public endpoint exists or contains fresh data.

## Verified code dependencies
The production TV widget in `scripts/banger_tv_match_stats.js` queries `nhl_prediction_archive` for pending games with `game_id, game_date, away_team, home_team, status, core41_away, core41_home, core42_away, core42_home, advanced_away, advanced_home, experimental_away, experimental_home`. It separately queries two CORE 4.3 internal views. The widget needs game date, both team identifiers and archive model fields to render its game picker and historical statistics. The SECURITY-113 reader only returns nine fields: game_id and eight CORE/GSAx metrics. Therefore the current nine-field contract is **insufficient for a complete TV cutover**. A separate approved public metadata source or a reviewed expanded projection is mandatory; neither is implemented here.

## Missing evidence
The nine-field contract has **no** publication timestamp, snapshot version, source as-of time, or completeness marker. Freshness cannot be established from game_id, numeric values or fetch time alone. A response of HTTP 200 is not proof of current predictions. Null is not zero; a null or absent value must never be presented as a verified prediction.

## Required preflight for any future cutover
1. Approve a narrowly scoped read-only public projection for game metadata, status and model inputs actually displayed; never expose internal records, flags, goalie evidence or secrets. Explicitly decide which legacy fields may be published.
2. Define provenance and freshness: server-generated `as_of` timestamp in UTC, allowed maximum age, schedule/game status alignment, and an explicit response version. Agree on the policy before enabling public mode.
3. Reject duplicate IDs, unknown games, invalid dates/statuses, malformed/non-finite metrics, future-dated or stale snapshots. Preserve missing-vs-zero semantics and Czech unavailable states.
4. Test empty, partial and stale responses, mismatched game IDs, HTTP errors, timeout, 401/403, and no fallback to internal views. Ensure a read-only endpoint with anonymous grants/RLS review.
5. Confirm endpoint existence, permissions and real data in an explicitly approved read-only preflight. Only then consider a separately approved, default-OFF frontend cutover and rollback.

## Safe decision
Keep `security/local/security113-tv-public-browser.js` unreferenced by production HTML and default mode `legacy`. No ACL, RLS, Supabase, production API or deployment changes in SECURITY-115.
