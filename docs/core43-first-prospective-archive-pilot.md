# CORE 4.3 first prospective archive pilot

This workflow is **manual-only**. It does not modify the 30-minute read-only monitor or schedule any writes. Choose a game ID with a future kickoff. By default `confirm_write=false`, so it only checks eligibility and produces an experimental SHA-256. To perform a real insert, manually select `confirm_write=true` after reviewing the upcoming game, the independent schedule and archived goalie data. GitHub environment `core43-archive-pilot` should be configured with required reviewer approval before enabling real writes; merely naming the environment does not enforce approval.

The script refuses historical or started games, stale capture windows, missing baseline, missing goalie identity and GSAx source evidence. The archive is experimental and not calibrated. An archive row is evidence of a prospective computation, not evidence of predictive accuracy.

**Still required:** inspect actual scheduled monitor runs and confirm a real eligible game; validate one end-to-end live pilot in GitHub Actions and the Supabase table. The connector available here cannot independently list scheduled workflow executions, so none are claimed. The pilot must not be used to retroactively fill gaps.
