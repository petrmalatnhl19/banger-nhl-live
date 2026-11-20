# VIDEO-08 — NHL feed / video integration verification

Date: 2026-11-20. Read-only inspection of deployed Supabase Edge Function `nhl-feed` v13 and existing Draft PR #369.

## Verified
- GitHub Actions run 44701804821 for VIDEO-07 commit 03df843 passed.
- The deployed `nhl-feed` Edge Function supports `kind=game&id={gameId}` and forwards to `https://api-web.nhle.com/v1/gamecenter/{gameId}/landing`.
- The Edge Function returns the upstream response body directly, without a projection/filter of `summary.scoring`; it uses a 45-second public cache header.
- VIDEO-07 uses the same landing response already loaded by the match detail; it introduces no additional fetch or new Supabase request.
- Goal video links are only shown when the returned goal has a valid `eventId` and `highlightClipSharingUrl` with an allowed NHL HTTPS host.

## Not yet verified
- Actual highlight links present in a specific current NHL game response; direct NHL endpoint was not accessible from the available browsing environment.
- Whether NHL.com playback works for a particular clip on Android in the user's region.
- LIVE updates without closing and reopening the match modal. Current VIDEO-07 only reads the landing snapshot fetched when the detail is opened.
- Media licensing/embedding permission. Current UI only opens the official NHL page.

## Next steps / acceptance
1. Add an authorized read-only integration probe against a known completed game, recording counts of goals, event IDs and valid clip links (never storing video bytes).
2. Verify whether clips appear in the existing landing feed during a live game and measure publication latency.
3. Reuse existing game detail refresh logic, if available, to update only video link state without resetting the selected tab; avoid new tight polling loops.
4. Add Android Chromium tests for link visibility, absent links, rapid game switching and stale response handling.
5. Keep PR draft; do not merge until playback and regression checks are confirmed.

No Supabase writes, deploys, or schema changes performed.


