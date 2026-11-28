# SECURITY-89 — Security decision

17 November 2026 · Draft PR #274 · **NO-GO**

| Priority | Finding and release implication |
|---|---|
| P0 | No P0 production incident was established by this metadata and fixture review. No production endpoint was probed for unauthorized operations. |
| P1 | Broad grants on the shadow input table include TRUNCATE, an operation outside RLS. The reviewed catalogs establish SQL privileges; external execution reachability remains unverified. |
| P1 | Three owner-rights shadow views grant public SELECT and can project internal CORE 4.3 data. Predictions and preview have an existing browser consumer. The tested candidate closes those direct public reads and removes values from the TV panel. A privacy-reviewed public projection or equivalent contract is a release prerequisite. |
| P1 | Managed Data API configuration, gateway authorization, deployment parity and external consumer evidence remain incomplete. SQL and mocked browser results cannot close these gates. |
| P1 | Privileged Edge scheduler handlers retain a broad service role. Application-level authorization and the archive-to-shadow trigger were reviewed. End-to-end authenticated and denied cases, secret lifecycle and scheduler identity need isolated verification. |
| P1 | Exact ACL restoration passed on the one-grantor fixture. Production ACL drift, grantor ability, rollback timing and effective access after managed API cache refresh remain unverified. |
| P2 | CORE 4.3 capture and archive trigger retain `search_path=public` in production. The narrow path worked in the fixture. Starter-evidence capture and event-trigger parity are separate work. |
| P2 | Other broad ACLs on analytics views and `favorite_players` need an independent review. Confirm favorite ownership predicates and database-role reachability, including the TRUNCATE grant. |
| P2 | Voice, playoff and live-news end-to-end behavior remains unverified in this environment. |

The inspection confirmed four active cron jobs and preserved all job definitions. Effective public EXECUTE was denied for the seven scoped ordinary functions; trigger and cron paths remain relevant even with direct public EXECUTE denied. Production grants, RLS, Edge and CORE 4.2 remain unchanged. See SECURITY-90 for the release procedure and evidence gates.
