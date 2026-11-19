# CAL-28T — offline archive provider metadata gate

The offline validator checks consistency between a separately signed CAL-28S receipt, CAL-28R policy and synthetic archive storage metadata. It rejects mismatched object versions/digests, non-compliance retention, disabled object lock, writer delete access, reader/auditor write access, expired retention, future-dated observations, unknown schema fields and claims of live-provider evidence.

**Important limitation:** The source must be explicitly `offline-fixture`. This validator does not query cloud storage or verify authenticated provider metadata, IAM policies, WORM enforcement, version existence or independent audit provenance. Its passing result always says `trusted:false`. Caller-provided booleans and timestamps are not evidence of actual security controls. The validator is not connected to pin advancement and must not be used as a production trust decision.

Future real integration needs a selected provider, separately managed credentials, authenticated provider API responses, effective IAM and retention verification, immutable version IDs, independent auditor attestations, negative tests and a human-reviewed rollout. No Supabase writes, production CORE 4.2 changes, merge, deployment or live dry-run.
