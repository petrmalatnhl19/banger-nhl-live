# VIDEO-18 — Embedded NHL goal player: feasibility and safe integration

Status: research / draft only. No playback implementation enabled.

## Existing implementation (verified from main)
- `video/live-highlights.js` collects official `highlightClipSharingUrl` and `highlightClip` metadata from NHL landing data.
- `video/live-highlights-ui.js` validates NHL HTTPS links and opens them in a new tab.
- Current UI is functional and must remain available as fallback.

## Licensing and technical gate
- NHL Terms of Service permit certain embedded content only under conditions, including noncommercial use, and allow NHL to disable embeds. An ordinary sharing URL is not proof of embeddability.
- Do not transform an NHL video page URL into an iframe URL by guesswork, scrape stream manifests, proxy/rehost media, or bypass embedding restrictions.
- Investigate whether the NHL provides a documented, authorized official embed URL/player for individual goal highlights, and verify framing restrictions and browser compatibility.
- Preserve attribution and official links. Do not assume commercial or advertising use is permitted.

## Proposed design (conditional on verified authorization)
1. Add a click-to-load, 16:9 embedded player within the match details goal section.
2. Only accept verified, explicitly allowlisted official embed URLs, not arbitrary share links.
3. Use iframe sandbox/allow/referrerpolicy according to the official player specification; never insert raw HTML from feeds.
4. Offer 'Watch on NHL.com' as the reliable fallback when embedding is unsupported or blocked.
5. Support Android viewport, fullscreen, keyboard access, focus return, closing and switching matches, lazy loading and no autoplay.
6. Avoid affecting CORE, Supabase, other PRs, or existing LIVE refresh behavior.

## Test / acceptance checklist
- Confirm actual authorized embed endpoint and its licensing conditions before coding playback.
- Test at least one real NHL goal clip on mobile and desktop, including blocked/expired/no-clip cases.
- Add unit tests for allowlist, injection resistance, cleanup, fallback and accessibility.
- Add browser smoke tests; keep Draft until all checks pass.

## Research references
- https://www.nhl.com/info/terms-of-service
- https://www.nhl.com/video/

## Current conclusion
Embedded playback is **not yet verified**. This PR records the safe gate and integration plan without claiming that NHL permits embedding arbitrary highlight links.
