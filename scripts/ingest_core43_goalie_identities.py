#!/usr/bin/env python3
"""Ingest goalie name-to-NHL-ID mapping from the SAME archived MoneyPuck CSV."""
import csv
import json
import os
import re
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

def main():
    url=os.environ.get("SUPABASE_URL","").strip().rstrip("/")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    if not url or not key:
        raise RuntimeError("Missing Supabase secrets")
    p=urlsplit(url)
    if p.scheme!="https" or not p.hostname or not p.hostname.endswith(".supabase.co") or p.path or p.query or p.fragment:
        raise ValueError("Unexpected Supabase URL")
    archives=sorted(Path("diagnostics/core43-goalie-snapshots").glob("*/metadata.json"))
    if not archives:
        raise ValueError("No archived MoneyPuck CSV")
    metadata=json.loads(archives[-1].read_text())
    rows=[]
    seen=set()
    with (archives[-1].parent/"goalies.csv").open(encoding="utf-8-sig",newline="") as f:
        for r in csv.DictReader(f):
            if r.get("situation")!="all":
                continue
            name=r.get("name","").strip()
            gid=r.get("playerId","").strip()
            team=r.get("team","").strip()
            if not name or not gid.isdigit() or not re.fullmatch(r"[A-Z]{3}",team):
                continue
            identity=(gid,team)
            if identity in seen:
                continue
            seen.add(identity)
            rows.append({"goalie_id":gid,"goalie_name":name,
                         "normalized_name":" ".join(name.lower().split()),
                         "team_code":team,"observed_at":metadata["fetchedAt"],
                         "source":"moneypuck_season_csv"})
    if not rows:
        raise ValueError("No valid goalie identities")
    req=urllib.request.Request(url+"/rest/v1/nhl_core43_goalie_identity_map?on_conflict=goalie_id,team_code,observed_at",
       data=json.dumps(rows).encode(),method="POST",
       headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"})
    with urllib.request.urlopen(req,timeout=35) as response:
        if response.status not in (200,201,204):
            raise RuntimeError("Identity insert failed")
    print(f"Archived {len(rows)} MoneyPuck goalie identities; no inferred starters")

if __name__=="__main__":
    main()
