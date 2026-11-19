# CORE43-CAL-31 — Offline pilot rehearsal

CAL-30 passed five GitHub Actions workflows on `b4742e2776ff62f463c3f7f9ca1095c75d602698`. CAL-31 adds read-only replay of an evidence dossier and records a negative historical rehearsal using a real NHL report and two public RFC 3161 services. The branch has no approved historical policy and the rehearsal returned `trusted: false`.

## Candidate authorities

| Service | Observation on 16 November 2026 (UTC) |
| --- | --- |
| Sectigo Qualified, operated by Sectigo (Europe) SL | The `/qualified` endpoint returned OID `0.4.0.2023.1.1`, SHA-256, the request nonce and signed accuracy of one second. The signer was Sectigo Qualified Time Stamping Signer #3. The certificate path to Sectigo Qualified Time Stamping Root R45 and both applicable signed CRLs verified. The root and intermediate matched the serial numbers and published thumbprints in Annex C. The Spanish trusted list identifies the operator's qualified timestamping service. [Sectigo practice statement](https://www.sectigo.com/uploads/files/eIDAS/Sectigo_eIDAS_TSPPS_v1.1.3.pdf) · [EU trusted-list browser](https://eidas.ec.europa.eu/efda/trust-services/browse/eidas/tls/tl/ES) |
| GlobalSign R45, operated by GlobalSign nv-sa | A new response from `/tsa/r45standard` retained OID `1.3.6.1.4.1.4146.2.3.2.2` and signed one-second accuracy. CAL-16 validated the request and signer, and both applicable signed CRLs verified. [GlobalSign practice statement](https://www.globalsign.com/en/repository/GlobalSign_TPS.pdf) |
| Sectigo standard and FreeTSA | The sampled responses omitted signed accuracy. The pilot profile still requires it. [Sectigo documentation](https://www.sectigo.com/uploads/legal/Sectigo-CPS-v5_2_2.pdf) · [FreeTSA](https://www.freetsa.org/index_en.php) |

Sectigo Qualified and GlobalSign R45 use distinct operators, root hierarchies and signer keys in the sampled responses. They are candidates for a pilot. The review did not establish independent clock and key custody, confirm that the services may be used for BANGER predictions, or validate national trusted-list XML signatures. Certificate and revocation checks were performed directly with pinned files. The published HTTP timestamp endpoints received only synthetic SHA-256 imprints and nonces. The NHL report and the prediction package stayed local.

Sectigo Qualified SHA-256 certificate fingerprints, in leaf-to-root order:

- `4ffc3bcb2da5c1623a5e98714df0c4e9ca622db07cb0eb6b2083388a0602029d`
- `cd0a3e00a1bdae3a159fa9e3d70f8e664f560fdce16357cbe440ed0b0d88244f`
- `f871f8976b4068d700d5f281084b4a29eaf4b8f35743330ba062fab46f58c2ed`

The Sectigo leaf and issuer CRLs were obtained from their certificate distribution points and validated at both bounds of the signed timestamp uncertainty. Their DER SHA-256 values were `ea031e7cf785019e852061e681d63f26862dbb0d59122afbe37667292fb42072` and `4151f7ef140dcfca82b16cb74dba00476c3d915216bab441484c91e62b578fd1`. GlobalSign's fingerprints and CRLs are listed in the [CAL-30 candidate catalog](core43-cal30-tsa-candidates.json).

## NHL rehearsal

| Item | Observed value |
| --- | --- |
| Match | Chicago Blackhawks at Florida Panthers, NHL game `2025020001`, 7 October 2025 |
| Scheduled | 21:00 UTC from the NHL boxscore |
| Actual start lower bound | 21:20 UTC from the Game Summary's 5:20 EDT, at minute resolution. The scheduled 5 p.m. Eastern broadcast and the NHL boxscore resolved the 12-hour clock for this example. |
| Actual verification cutoff | 21:00 UTC, the earlier of scheduled start and actual-start lower bound |
| Test package | A new synthetic CAL-13 package with the real match identifiers was assembled during CAL-31. Its SHA-256 was `acf76e5229ed9c5aa4bd33fff25a7908e7e1b8cf5f3104fcbfb4f564cdb1e951`. |
| TSA evidence | The two actual responses used separate nonces and bound the same synthetic bytes. Both timestamp intervals were on 16 November 2026 UTC, long after the 2025 cutoff. |
| Offline result | `{"trusted":false,"status":"rejected","reason":"cal30_timestamp_order"}` |

The report and boxscore were retrieved independently from the test publisher. A disposable observer key signed the report digest and normalized time for this exercise. The original bytes are represented by SHA-256 `ff30ff83d0311a17a64fdf248dd80d04e30d694aff7d34df65139e5d51402d4f` (report) and `75b9bf588856203f7338580c59b0f1b639a84ac29247c6580d57b4442446f8eb` (boxscore). The response digests were `e77d8e75a1e2278cf3e0aa2d9e50bc249c03c0b4c8ad69a38bc94d8143c324d8` (Sectigo) and `3a26f62233b565db6f9ab5af1f740c8ed2d38ff30ac5be4f8495391f661cf7bd` (GlobalSign). This negative rehearsal shows that obtaining new valid timestamps cannot turn an old match into a verified pregame prediction. [NHL Game Summary](https://www.nhl.com/scores/htmlreports/20252026/GS020001.HTM) · [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2025020001/boxscore) · [ESPN broadcast schedule](https://espnpressroom.com/press-release/puck-drops-on-2025-26-nhl-season-october-7-with-opening-night-tripleheader-on-espn/)

## Replay and next decision

```sh
node scripts/core43_cal31_replay.cjs dossier.json policy.json "$APPROVED_POLICY_SHA256"
```

Use the expected SHA-256 from verifier-owned configuration. The compact UTF-8 dossier uses schema `core43_cal31_dossier_v1` and the [CAL-30 evidence fields](core43-cal30-historical-trust-audit.md#offline-interface-and-provenance). Use unpadded canonical base64url for every byte value, including each certificate and CRL. The CLI returns JSON and exits with zero only for `trusted: true`. Missing evidence, malformed dossiers, simulations and late submissions all exit with one. The CAL-30 regression suite exercises file limits and format checks through the replay entry point with disposable material, offline.

Before activating any historical admission, document permitted use and operational independence for both TSA endpoints, provision an independently managed NHL observer key, and approve an externally pinned policy. The first positive rehearsal needs an eligible future match with archived pregame timestamps. Verify it after acquiring the official start report. Use the reviewed policy digest and review time when consuming the gate's result.
