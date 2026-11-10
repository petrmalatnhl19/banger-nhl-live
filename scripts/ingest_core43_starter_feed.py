#!/usr/bin/env python3
"""CORE 4.3: optional authenticated starter feed ingestion.

Requires CORE43_STARTER_FEED_URL and CORE43_STARTER_FEED_TOKEN secrets.
Feed contract: JSON {"reports":[{"gameId":123,"teamCode":"DAL",
"goalieId":"8479979","status":"confirmed",
"confirmationBasis":"explicit_pregame_report",
"sourceName":"...","sourceUrl":"https://...",
"sourcePublishedAt":"2026-11-07T12:00:00Z"}]}.
Never infer starter from projected/expected/box score or missing source timestamp.
"""
import datetime as dt
import json
import os
import re
import urllib.request
from urllib.parse import urlsplit

def stamp(value):
    if not isinstance(value,str) or not value.endswith("Z"):
        raise ValueError("Timestamp must be UTC ISO 8601 with Z")
    return dt.datetime.fromisoformat(value.replace("Z","+00:00"))

def main():
    url=os.environ.get("CORE43_STARTER_FEED_URL","").strip()
    token=os.environ.get("CORE43_STARTER_FEED_TOKEN","").strip()
    sb=os.environ.get("SUPABASE_URL","").strip().rstrip("/")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","").strip()
    if not url or not token:
        print("::warning title=CORE 4.3 starter feed inactive::Confirmed-starter feed URL or token missing; no verified evidence can be imported")
        return
    if not sb or not key:
        raise RuntimeError("Missing Supabase service configuration")
    for value in (url,sb):
        p=urlsplit(value)
        if p.scheme!="https" or not p.hostname or p.username or p.password or p.fragment:
            raise ValueError("Invalid secure endpoint")
    if not urlsplit(sb).hostname.endswith(".supabase.co"):
        raise ValueError("Unexpected Supabase host")
    observed=dt.datetime.now(dt.timezone.utc)
    req=urllib.request.Request(url,headers={"Authorization":"Bearer "+token,"Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=25) as response:
        feed=json.load(response)
    if not isinstance(feed,dict) or not isinstance(feed.get("reports"),list):
        raise ValueError("Invalid feed format")
    if len(feed["reports"])>500:
        raise ValueError("Oversized feed")
    schedule_req=urllib.request.Request(sb+"/rest/v1/nhl_core43_schedule_snapshots?select=game_id,away_team,home_team,kickoff_at&order=fetched_at.desc&limit=1000",headers={"apikey":key,"Authorization":"Bearer "+key})
    with urllib.request.urlopen(schedule_req,timeout=25) as response:
        schedule=json.load(response)
    games={}
    ambiguous=set()
    for row in schedule:
        game_id=row["game_id"]
        previous=games.get(game_id)
        if previous and any(previous[field]!=row[field] for field in ("kickoff_at","away_team","home_team")):
            ambiguous.add(game_id)
        else:
            games.setdefault(game_id,row)
    valid=[]
    for r in feed["reports"]:
        if not isinstance(r,dict):
            continue
        g=games.get(r.get("gameId"))
        if not g or r.get("gameId") in ambiguous or r.get("teamCode") not in (g["away_team"],g["home_team"]):
            continue
        if r.get("status")!="confirmed" or r.get("confirmationBasis")!="explicit_pregame_report":
            continue
        if not re.fullmatch(r"\\d+",str(r.get("goalieId",""))):
            continue
        source=r.get("sourceUrl","")
        name=r.get("sourceName","")
        if not isinstance(source,str) or urlsplit(source).scheme!="https" or not urlsplit(source).hostname or not isinstance(name,str) or len(name.strip())<3:
            continue
        try:
            published=stamp(r.get("sourcePublishedAt"))
            kickoff=dt.datetime.fromisoformat(g["kickoff_at"].replace("Z","+00:00"))
        except (ValueError,TypeError):
            continue
        if not published<=observed<kickoff:
            continue
        valid.append({"game_id":r["gameId"],"team_code":r["teamCode"],"goalie_id":str(r["goalieId"]),"evidence_status":"confirmed","source_name":name,"source_url":source,"source_published_at":published.isoformat(),"verified_at":observed.isoformat()})
    if ambiguous:
        print(f"Skipped {len(ambiguous)} games with conflicting schedule snapshots")
    if not valid:
        print("::warning title=CORE 4.3 no confirmed starters::Feed returned no valid timestamped pregame confirmations")
        return
    req=urllib.request.Request(sb+"/rest/v1/nhl_core43_starter_evidence?on_conflict=game_id,team_code,goalie_id,source_url,source_published_at",data=json.dumps(valid).encode(),method="POST",headers={"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json","Prefer":"resolution=ignore-duplicates,return=minimal"})
    with urllib.request.urlopen(req,timeout=30) as response:
        if response.status not in (200,201,204):
            raise RuntimeError("Supabase evidence insert failed")
    print(f"Accepted {len(valid)} timestamped confirmed goalie reports")

if __name__=="__main__":
    main()
