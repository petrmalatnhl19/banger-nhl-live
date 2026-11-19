# CAL-29 — independent RFC 3161 timestamp authority gate (offline)

CAL-29 validates the full list of authority records and rejects duplicate declared trust domains or signer certificate fingerprints before checking the tokens. Each token then goes through CAL-16's OpenSSL RFC 3161 verification of the signature, request nonce, SHA-256 package digest, policy OID, signer certificate pin, certificate chain, and declared accuracy. The latest possible time of every token must be strictly before the supplied game start.

CAL-04 CI exercises this with two ephemeral certificate chains and two genuine RFC 3161 tokens issued locally over the same signed simulation package. CAL-29 returns `cryptographicTokensValid: true` and `trusted: false`. The regression checks also cover a timestamp at or after the cutoff, changed package bytes, and a mismatched request nonce.

## Security audit

| Area | Present guarantee | Required before a historical pilot |
| --- | --- | --- |
| Authority independence | CAL-29 compares the domain labels and pins supplied by the caller. Different certificate fingerprints alone establish certificate identity. | Use an independently governed registry that binds canonical domain IDs to approved operators, signer public keys, pinned CA material, and policy OIDs. Require distinct operators and signing keys, verify clock independence, and rehearse with two approved services. |
| Certificate lifecycle | CAL-16 validates the chain at the signed time against the supplied CA material and checks the signer's certificate fingerprint. | Define a revocation and rotation policy and retain verifiable status evidence for offline review. [RFC 3161 §2.2 and §5](https://www.rfc-editor.org/rfc/rfc3161.html) |
| Match timing | CAL-29 applies a strict cutoff to the supplied timestamp string. CAL-16's acceptance path also compares the scheduled and actual starts, using caller-supplied NHL evidence. | Independently acquire and archive the NHL evidence. Bind the actual start, schedule, game ID and teams to the signed package, and apply the earlier cutoff. |
| Evidence and acceptance | CAL-29 verifies timestamps over exact package bytes. CAL-13 verifies the export and witness signatures. The existing CAL-16 acceptance path uses one timestamp. | Require both CAL-29 tokens and CAL-13 package validation at historical admission. Preserve the package, requests, responses, trust profiles and NHL source evidence together to permit independent re-verification. |

The verification remains offline. The synthetic test uses local clocks and synthetic CA material. Verification against external TSA services and independently collected NHL evidence is pending.
