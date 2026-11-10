#!/usr/bin/env python3
"""Read-only audit: legacy RotoWire evidence must not inherit snapshot timestamps."""
import json
import os
import urllib.parse
import urllib.request

def suspect_rows(evidence, observations):
    snapshots = {(str(o["game_id"]), o["team_code"], o["source_snapshot_at"]) for o in observations}
    return [e for e in evidence if (str(e["game_id"]), e["team_code"], e["source_published_at"]) in snapshots]

def fetch_rows(base, key, table, fields):
    rows = []
    for offset in range(0, 100000, 1000):
        params = urllib.parse.urlencode({"select": fields, "limit": 1000, "offset": offset})
        req = urllib.request.Request(
            f"{base}/rest/v1/{table}?{params}",
            headers={"apikey": key, "Authorization": "Bearer " + key, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)
        if not isinstance(batch, list):
            raise ValueError("Unexpected Supabase REST response")
        rows.extend(batch)
        if len(batch) < 1000:
            return rows
    raise RuntimeError("Audit exceeded row limit; cannot claim complete coverage")

def main():
    base = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    host = urllib.parse.urlsplit(base)
    if host.scheme != "https" or not host.hostname or not host.hostname.endswith(".supabase.co") or host.path or host.query or host.fragment:
        raise ValueError("Unexpected Supabase endpoint")
    evidence = fetch_rows(base, key, "nhl_core43_starter_evidence",
                          "game_id,team_code,source_name,source_published_at")
    observations = fetch_rows(base, key, "nhl_core43_rotowire_observations",
                              "game_id,team_code,source_snapshot_at")
    rotowire = [e for e in evidence if e.get("source_name") == "RotoWire"]
    suspicious = suspect_rows(rotowire, observations)
    print(f"Evidence provenance: total={len(evidence)}, rotowire={len(rotowire)}, snapshot_timestamp_matches={len(suspicious)}")
    if suspicious:
        print(f"::warning title=CORE 4.3 legacy provenance::Found {len(suspicious)} RotoWire evidence rows whose publication time equals an archived source snapshot. Treat these as unverified pending independent source validation.")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as out:
            out.write(f"### CORE 4.3 legacy evidence provenance\nRotoWire evidence rows: {len(rotowire)}. Matching source snapshot timestamps: **{len(suspicious)}**. These matches are not independently verified publication times. No records were changed.\n")
    # Informational audit only; do not rewrite or delete historical evidence.
if __name__ == "__main__":
    main()
