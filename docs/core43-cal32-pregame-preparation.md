# CORE43-CAL-32 — Prepare timestamp requests before puck drop

The CAL-31 rehearsal established that GlobalSign R45 and Sectigo Qualified can issue compatible tokens over the same bytes, and that CAL-30 rejects both when issued after the cutoff. CAL-32 prepares and preserves the exact requests for a single approved future matchup. The branch contains no live pilot plan or credentials.

## Before the match

1. Document permitted use and operational independence of the two TSA services. Assign the NHL report to a separately managed observer as described in the [CAL-30 audit](core43-cal30-historical-trust-audit.md#offline-interface-and-provenance).
2. Select one game. Approve the planned UTC kickoff and NHL game ID using the official schedule. The operator creates a compact UTF-8 JSON plan with schema `core43_cal32_pregame_plan_v1`, `mode` (`historical` or `simulation`), `gameId`, `kickoffAt`, and `packageRegistry` (`source`, Ed25519 SPKI `rootKey` in unpadded base64url, and `registrySha256`). Provide exactly two `authorities` with independently reviewed `id`, `operatorId`, and timestamp `policyOid`. Supply its SHA-256 from operator-held configuration. The final CAL-30 review policy is separate because it pins the CRLs and the review time available after capture.
3. After the publisher and witness have signed the CAL-13 bundle, run the preparation command before the planned kickoff.

```sh
(umask 077
 set -C
 node scripts/core43_cal32_prepare_pregame.cjs bundle.json registry.json plan.json "$APPROVED_PLAN_SHA256" > prepared.json)
```

Check the process exit status and the JSON status before using the output. The command verifies the plan pin, signed CAL-13 registry, exact bundle, witness receipt, and game and kickoff binding. It checks the local preparation window before and after OpenSSL generates two independent requests. Each request uses SHA-256 over the original bundle bytes, its configured OID, and a distinct nonzero nonce. The archive preserves the bundle, registry and both requests byte-for-byte in unpadded base64url, with request digests for later comparison. The `preparedAt` field records a local clock reading for diagnostics. The preparation result always contains `trusted: false`. [RFC 3161](https://www.rfc-editor.org/rfc/rfc3161.html) · [OpenSSL ts](https://docs.openssl.org/3.0/man1/openssl-ts/)

## After preparation and after the match

For an authorized run, the operator sends each raw decoded request to its approved endpoint and archives the original response with the request. Preserve the approved plan and its independently held digest alongside those artifacts. Check that the requests placed in the CAL-31 dossier match the saved request digests and authority IDs. The package and registry must be the exact archived bytes.

The NHL observer independently archives the official report and signs the normalized actual start. Finish the CAL-30 policy and run [CAL-31 offline replay](core43-cal31-pilot-rehearsal.md#replay-and-next-decision) with the review policy's externally held digest. CAL-30 compares the upper bound of each signed TSA interval against both the scheduled and actual starts and applies the certificate, revocation and observer checks.

CI exercises request generation and verifies both resulting responses with ephemeral RFC 3161 authorities. It covers wrong game IDs, substituted registries, missing plan pins, shared operators, and preparation before the witness or at kickoff. These results are simulations. The first positive pilot still requires approved operational evidence and two real pregame responses followed by the independently verified NHL report.
