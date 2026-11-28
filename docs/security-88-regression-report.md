# SECURITY-88 — Regression evidence

The application and CORE calculation source are unchanged. The branch adds a Chromium fixture for the actual TV Match Stats script. It models the archive endpoint remaining available and the two experimental views returning a permission error. All HTTP requests from the fixture are intercepted. It confirms CORE 4.2 archive values still render and CORE 4.3 verified scores, previews and GSAx change from numbers to dashes. This is a confirmed compatibility gap if preserving all current features is required.

| Area | Evidence and limits |
|---|---|
| Startup and games | Chromium startup against local HTML with outbound traffic blocked. UX-01 game filters and date-navigation race fixtures passed. |
| Detail and calendar | Concurrent detail, stale-response cleanup and date-switching fixtures passed in Chromium. No production feed was sampled. |
| Standings, skaters, goalies and analytical reports | Existing CI browser suites cover fixtures for these surfaces. The local headless distribution closed the browser while opening later contexts in the mobile analytics, mobile statistics and standings-race suites. Use the exact-commit CI jobs for full fixture status. |
| CORE 4.2 and public schedule | CORE performance integration and public schedule contract passed. PostgreSQL fixture preserved status, analytics and schedule reads; the browser TV fixture retained CORE 4.2 values. This does not measure production predictions. |
| Experimental CORE 4.3 | 33 workflow commands passed locally. Synthetic SQL capture retained functionality; the TV fixture confirmed public display data is lost upon revocation. |
| News, playoffs and voice | Startup and repository checks provide limited coverage only. Live news loading, a complete playoff navigation flow and native Android speech were not exercised. |
| Whole application against revised managed API | Pending representative isolated Supabase deployment with equivalent gateway configuration and synthetic data. |

The GitHub browser-smoke job includes the new TV check after the existing frontend scenarios. Green fixture tests do not clear the compatibility gap.
