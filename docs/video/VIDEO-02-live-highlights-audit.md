# VIDEO-02 — LIVE NHL highlights: integration audit

Status: design/read-only audit, no production integration.

## Verified in current main index.html
- The app contains an Arena/game detail view, period goals and event presentation.
- NHL gamecenter requests are routed by a frontend `get(url,start=0)` helper through Supabase Edge Function `nhl-feed`.
- The router currently maps `/gamecenter/.../boxscore` to `kind=boxscore` and other gamecenter URLs to `kind=game`; this does NOT establish whether highlight media fields survive the proxy.
- No literal `highlightClip` occurrence was found in the current main `index.html`.

## Next verification (no assumptions)
1. Inspect the actual Edge Function `nhl-feed` implementation and response filtering; do not modify it in this stage.
2. Use a confirmed NHL game ID from an actual completed game and retrieve official Gamecenter landing and play-by-play responses through the currently approved routes.
3. Record each goal's event ID and any highlight clip ID/URL, including missing fields and HTTP status. Never infer video availability from the existence of a goal.
4. Verify NHL media usage and embedding terms, CORS, content type, Android browser playback and fallback to an official link.
5. For a future live game, measure delay between event appearance and clip availability; historic response alone cannot prove publication latency.
6. Design a separate opt-in frontend adapter that reads clip metadata, deduplicates by game ID + event ID, and never changes CORE models or DATA pipelines.
7. Add fixtures for clips available, pending, removed, malformed, duplicate, delayed, and no embed permission.
8. Only after successful checks consider VIDEO-03 UI implementation in this isolated branch.

## Constraints
- No Supabase writes or migrations.
- No production deployment or merge.
- No changes to CORE, DATA, SECURITY, or existing live polling.
- Do not proxy or redistribute NHL video files; use only authorized official playback or links.
