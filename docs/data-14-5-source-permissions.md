# DATA-14.5 — Source and permission assessment (read-only)

Date: 2026-11-20. This is an engineering assessment, not a legal opinion.

## Existing production usage
- NHL.com: 32/32 published team projections in committed lineup_source_usage_report.json. This is observed usage, **not evidence of permission**.
- Fantasy Roundup: 0 published teams, connectivity probe succeeded, automatic reuse not authorized in the project.
- Between the Lines: 0 published teams, connectivity probe succeeded, automatic reuse not authorized in the project.
- RotoWire and The Morning Puck: goalie-oriented code paths, not validated lineup replacements.

## External evidence and limits
- NHL terms: https://www.nhl.com/info/terms-of-service — prohibits unauthorized scraping/harvesting; content redistribution and commercial use have restrictions. Existing automation should receive a separate rights review.
- Daily Faceoff: https://www.dailyfaceoff.com/ — publicly advertises line combinations, but availability is not a license to republish or automatically collect them.
- PuckAPI: https://puckapi.com/compare/nhl-api — offers documented API and a free tier; check coverage for line combinations, permitted redistribution, and costs directly before integrating. No permission or lineup coverage verified.
- Hockey Insights: https://hockeyinsights.ca/about-data/ — documents PuckPedia and Daily Faceoff as lineup sources in its own project; this does not authorize us to reuse its files.

## Next safe implementation gate
1. Obtain provider-specific written permission or an explicit API license for the intended use, including public display, caching, redistribution, and commercial usage.
2. Verify data scope: full forward lines, defense pairs, publication timestamp, team and game identity, injuries, and source reliability.
3. Add a dedicated, tested adapter for a licensed provider only; keep it disabled until credentials/permission are configured.
4. Preserve provenance, source freshness, independent roster validation and unconfirmed status. Never silently fill a missing line.
5. Recheck the existing NHL.com collector separately. The DATA-14 gate is offline and does not change current publishing behavior.

No third-party lineups were fetched, copied or published in DATA-14.5.
