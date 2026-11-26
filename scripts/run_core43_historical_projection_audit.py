#!/usr/bin/env python3
"""Read-only end-to-end historical RotoWire vs official NHL goalie audit."""
import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from audit_official_final_goalies import fetch_json, final_goalies

TABLES = {
    "observations": ("nhl_core43_rotowire_observations", "game_id,team_code,goalie_name,observed_status,observed_at,source_snapshot_at"),
    "schedules": ("nhl_core43_schedule_snapshots", "game_id,kickoff_at,away_team,home_team,fetched_at"),
    "identityMap": ("nhl_core43_goalie_identity_map", "goalie_id,goalie_name,team_code,source,observed_at"),
}
def read_table(base, key, table, columns, order_by="game_id", cutoff=None, time_field=None):
    if order_by not in ("game_id", "goalie_id"):
        raise ValueError("Unsupported pagination order")
    # Sort by every selected field to break ties between repeated game IDs.
    fields = columns.split(",")
    if order_by not in fields:
        raise ValueError("Pagination order must be selected")
    order = ",".join(f"{field}.asc.nullslast" for field in
                     [order_by] + [field for field in fields if field != order_by])
    rows = []
    seen = set()
    expected = None
    while True:
        start = len(rows)
        query = {"select": columns, "order": order,
                 "limit": "500", "offset": str(start)}
        if cutoff is not None:
            if time_field not in fields or time_field not in ("observed_at", "fetched_at"):
                raise ValueError("Unsupported cutoff field")
            query[time_field] = "lt." + cutoff
        params = urllib.parse.urlencode(query)
        req = urllib.request.Request(f"{base}/rest/v1/{table}?{params}",
            headers={"apikey": key, "Authorization": "Bearer " + key,
                     "Accept": "application/json", "Prefer": "count=exact"})
        with urllib.request.urlopen(req, timeout=30) as response:
            batch = json.load(response)
            content_range = response.headers.get("Content-Range", "")
        if not isinstance(batch, list) or len(batch) > 500:
            raise ValueError("Unexpected Supabase response")
        interval, sep, total = content_range.partition("/")
        if not sep or not total.isdigit():
            raise ValueError("Missing exact pagination count")
        count = int(total)
        if expected is None:
            expected = count
        if count != expected:
            raise ValueError("Historical table changed during pagination; retry audit")
        if batch:
            if interval != f"{start}-{start + len(batch) - 1}":
                raise ValueError("Unexpected pagination range")
        elif start != expected:
            raise ValueError("Incomplete historical audit: premature empty page")
        for row in batch:
            if not isinstance(row, dict) or any(field not in row for field in fields):
                raise ValueError("Incomplete historical row")
            signature = json.dumps(row, sort_keys=True, separators=(",", ":"))
            if signature in seen:
                raise ValueError("Duplicate historical row: refusing ambiguous pagination")
            seen.add(signature)
        rows.extend(batch)
        if len(rows) > expected:
            raise ValueError("Historical pagination exceeded exact count")
        if len(rows) == expected:
            return rows

def read_stable_table(base, key, table, columns, cutoff, time_field, order_by="game_id"):
    # Two complete reads of the same bounded set detect persistent same-count
    # replacements and edits. This is not a transactional database snapshot.
    args = (base, key, table, columns)
    kwargs = dict(order_by=order_by, cutoff=cutoff, time_field=time_field)
    first = read_table(*args, **kwargs)
    second = read_table(*args, **kwargs)
    if first != second:
        raise ValueError("Historical rows changed between verification passes")
    return first

def latest_schedule(rows):
    result={}
    for row in rows:
        try:
            fetched=datetime.fromisoformat(row["fetched_at"].replace("Z","+00:00"))
            kickoff=datetime.fromisoformat(row["kickoff_at"].replace("Z","+00:00"))
        except (ValueError,KeyError,AttributeError,TypeError):continue
        if fetched.tzinfo is None or kickoff.tzinfo is None or fetched>=kickoff:continue
        game=str(row.get("game_id"))
        old=result.get(game)
        if old is None or fetched>old[0]:result[game]=(fetched,row)
    return [entry[1] for entry in result.values()]

def collect_official(game_ids,fetch=fetch_json):
    games=[];errors=[]
    for game_id in sorted(game_ids):
        try:
            result=final_goalies(fetch(f"gamecenter/{game_id}/boxscore"))
            if result is not None:
                games.append({"gameId":game_id,"away":result["awayTeam"],"home":result["homeTeam"]})
        except (OSError,ValueError,KeyError,TimeoutError) as exc:
            errors.append({"gameId":game_id,"errorType":type(exc).__name__})
    return games,errors

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="diagnostics/core43-historical-projections.json")
    args=parser.parse_args()
    base=os.environ.get("SUPABASE_URL","").rstrip("/")
    key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY","")
    parts=urllib.parse.urlsplit(base)
    if parts.scheme!="https" or not parts.hostname or not parts.hostname.endswith(".supabase.co") or parts.path or parts.query or parts.fragment or not key:
        parser.error("Valid Supabase URL and server-side service key required")
    cutoff=datetime.now(timezone.utc).isoformat()
    observations=read_stable_table(base,key,*TABLES["observations"],cutoff,"observed_at")
    schedules=latest_schedule(read_stable_table(base,key,*TABLES["schedules"],cutoff,"fetched_at"))
    ids={int(r["game_id"]) for r in observations if str(r.get("game_id","")).isdigit()}
    official,errors=collect_official(ids)
    identity_map=read_stable_table(base,key,*TABLES["identityMap"],cutoff,"observed_at",order_by="goalie_id")
    payload={"observations":observations,"schedules":schedules,"officialGames":official,"identityMap":identity_map}
    js="const fs=require('fs');const {compareHistoricalProjections}=require('./scripts/core43_historical_projection_join.cjs');const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(compareHistoricalProjections(input)));"
    proc=subprocess.run(["node","-e",js],input=json.dumps(payload),text=True,capture_output=True,check=True,timeout=60)
    result=json.loads(proc.stdout)
    result["generatedAt"]=datetime.now(timezone.utc).isoformat()
    result["sourceCounts"]={"observations":len(observations),"scheduleGames":len(schedules),"officialFinalGames":len(official),"identityMapEntries":len(identity_map),"officialFetchFailures":len(errors)}
    result["officialFetchErrors"]=errors
    result["historicalPredictionMutation"]=False
    result["auditCutoffExclusive"]=cutoff
    result["paginationVerification"]="two matching bounded reads per table; not a transactional snapshot"
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"rowsCompared":result["rowsCompared"],"sourceCounts":result["sourceCounts"],"countsByLeadTime":result["countsByLeadTime"],"uniqueGameTeamPairs":result["uniqueGameTeamPairs"],"uniqueGames":result["uniqueGames"],"uniqueIdComparedPairs":result["uniqueIdComparedPairs"],"uniqueIdMatchedPairs":result["uniqueIdMatchedPairs"],"nameIdDisagreements":result["nameIdDisagreements"]}))
if __name__=="__main__":main()
