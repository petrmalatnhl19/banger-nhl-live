#!/usr/bin/env python3
"""Optional service-role-only ingest of a freshly archived MoneyPuck snapshot.
Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY as GitHub Actions secrets.
Never logs secrets, never modifies existing snapshots, never backfills old games.
"""
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.request
from urllib.parse import urlsplit

def ingest():
    url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Supabase ingestion skipped: server-side secrets not configured")
        return
    parsed = urlsplit(url)
    if (parsed.scheme != "https" or not parsed.hostname or
            not parsed.hostname.endswith(".supabase.co") or
            parsed.username or parsed.password or parsed.query or parsed.fragment or
            parsed.path not in ("", "/") or parsed.port is not None):
        raise ValueError("Unexpected Supabase URL: expected https://<project-ref>.supabase.co")
    folders = sorted(Path("diagnostics/core43-goalie-snapshots").glob("*"))
    if len(folders) != 1:
        raise ValueError("Expected exactly one snapshot from this workflow run")
    folder = folders[0]
    raw = (folder / "goalies.csv").read_bytes()
    meta = json.loads((folder / "metadata.json").read_text(encoding="utf-8"))
    if hashlib.sha256(raw).hexdigest() != meta["sha256"]:
        raise ValueError("Snapshot checksum mismatch")
    rows = list(csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))))
    if len(rows) != meta["rows"]:
        raise ValueError("Snapshot row count mismatch")
    payload = []
    for r in rows:
        if r.get("situation") != "all":
            continue
        team = r.get("team", "").upper()
        if len(team) != 3 or not team.isalpha():
            continue
        xga, ga, shots = float(r["xGoals"]), float(r["goals"]), float(r["ongoal"])
        if min(xga, ga, shots) < 0 or not shots.is_integer():
            raise ValueError("Invalid goalie data")
        payload.append({
            "goalie_id": str(r["playerId"]),
            "team_code": team,
            "situation": "all",
            "fetched_at": meta["fetchedAt"],
            "source_sha256": meta["sha256"],
            "x_goals_against": xga,
            "goals_against": ga,
            "shots_against": int(shots),
        })
    if not payload:
        raise ValueError("No eligible all-situation goalie rows")
    endpoint = url + "/rest/v1/nhl_core43_goalie_snapshots?on_conflict=source_sha256,goalie_id,team_code,situation"
    # Prefer minimal return; do not print HTTP error bodies that might contain sensitive details.
    request = urllib.request.Request(endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"apikey": key, "Authorization": "Bearer " + key,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=ignore-duplicates,return=minimal"},
        method="POST")
    with urllib.request.urlopen(request, timeout=40) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError("Snapshot insert failed")
    print(f"Supabase ingest request completed for {len(payload)} all-situation goalie rows; snapshot={meta['sha256'][:12]}")

if __name__ == "__main__":
    ingest()
