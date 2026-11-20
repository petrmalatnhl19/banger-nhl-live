# VIDEO-20 — Authorized embed decision and integration contract

Date: 2026-11-20. Draft research only; no production player.

## Verified official policy
Official Czech NHL Terms: https://www.nhl.com/cs/info/terms-of-service
- NHL services **may** allow NHL Content embedding on other websites, for non-commercial purposes only; NHL can disable embedding at any time.
- Without express written NHL approval, embedded content cannot be used to obtain advertising, subscription, or other commercial revenue.
- NHL disallows linking from sites requiring registration in connection with NHL content or collecting personal data in connection with it.
- Ordinary video share URLs do not establish that a clip supports a third-party embedded player.

## Findings
- Existing implementation: `video/live-highlights.js` collects `highlightClipSharingUrl`; `video/live-highlights-ui.js` creates an external official NHL link.
- No verified documented per-goal iframe/embed endpoint, authorized embed snippet, or successful embedded playback test is available in the reviewed evidence.
- **Decision: NO-GO for activating embedded NHL playback at this time.** Existing links must remain unchanged.

## Safe implementation contract once authorization and endpoint are verified
- Embed only an official URL returned by an explicitly supported NHL integration method. Never guess URL patterns from `highlightClip` or transform share URLs into stream URLs.
- Explicit host allowlist, HTTPS, strict URL validation, no dynamic HTML insertion.
- User-initiated click-to-load, 16:9 mobile-responsive player, accessible close control, fullscreen only when supported.
- Unload player on close, game change, or leaving detail; no autoplay and no background playback.
- Visible fallback 'Přehrát na NHL.com' available before and after failure.
- No scraping, rehosting, proxying, DRM circumvention, or media extraction.

## Acceptance gate
1. Evidence of official NHL embed method for an individual goal and its current terms, including commercial use implications.
2. Real sample goal successfully plays in authorized embedded form in Android Chrome and desktop Chrome, with fallback behavior checked.
3. Regression tests: allowed URL, disallowed host, missing clip, blocked iframe, cleanup on game switch, accessibility, no CORE or Supabase changes.
4. CI green, manual review, and explicit merge authorization.

## Action if official embed remains unavailable
Retain the existing reliable external NHL links. Request explicit permission or supported integration details from NHL before adding in-app playback.
