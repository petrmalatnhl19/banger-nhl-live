#!/usr/bin/env python3
"""Archive existing RotoWire JSON as timestamped observations (not verified evidence)."""
import datetime as dt
import json
import os
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
    data=json.loads(Path("rotowire_goalies.json").read_text(encoding="utf-8"))
    observed=dt.datetime.fromisoformat(data["updatedAt"].replace("Z","+00:00"))
    now=dt.datetime.now(dt.timezone.utc)
    if observed.tzinfo is None or observed>now+dt.timedelta(minutes=2):
        raise ValueError("Invalid observation timestamp")
    rows=[]
    seen=set()
    for item in data.get("games",[]):
        game=item.get("gameId")
        team=item.get("team")
        name=item.get("goalie")
        status=item.get("status")
        source=item.get("source")
        if not isinstance(game,int) or not isinstance(team,str) or len(team)!=3 or not team.isupper():
            continue
        if not isinstance(name,str) or not name.strip() or status not in ("confirmed","projected","unknown"):
            continue
        if not isinstance(source,str) or urlsplit(source).scheme!="https" or urlsplit(source).hostname not in ("www.rotowire.com","rotowire.com"):
            continue
        pair=(game,team)
        if pair in seen:
            raise ValueError("Ambiguous duplicate game/team observation")
        seen.add(pair)
        rows.append({"game_id":game,"team_code":team,"goalie_name":name.strip(),"observed_status":status,"observed_at":observed.isoformat(),"source_url":source})
    if not rows:
        raise ValueError("No valid RotoWire observations")
    req=urllib.request.Request(url+"/rest/v1/nhl_core43_rotowire_observations?on_conflict=game_id,team_code,observed_at",
      data=json.dumps(rows).encode("utf-8"),method="POST",
      headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"})
    with urllib.request.urlopen(req,timeout=40) as response:
        if response.status not in (200,201,204):
            raise RuntimeError("Observation ingestion failed")
    print(f"Archived {len(rows)} RotoWire observations, confirmed={sum(r['observed_status']=='confirmed' for r in rows)}, projected={sum(r['observed_status']=='projected' for r in rows)}")
    print("No entries promoted to verified starting goalie evidence")

if __name__=="__main__":
    main()
