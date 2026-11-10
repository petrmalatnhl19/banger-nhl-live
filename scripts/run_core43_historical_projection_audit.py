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
def read_table(base, key, table, columns, max_rows=20000):
    rows=[]
    for start in range(0,max_rows,500):
        params=urllib.parse.urlencode({"select":columns,"order":"game_id.asc","limit":"500","offset":str(start)})
        req=urllib.request.Request(f"{base}/rest/v1/{table}?{params}",headers={"apikey":key,"Authorization":"Bearer "+key,"Accept":"application/json"})
        with urllib.request.urlopen(req,timeout=30) as response:
            batch=json.load(response)
        if not isinstance(batch,list):raise ValueError("Unexpected Supabase response")
        rows.extend(batch)
        if len(batch)<500:return rows
    raise ValueError("Row cap reached: refusing incomplete historical audit")

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
    observations=read_table(base,key,*TABLES["observations"])
    schedules=latest_schedule(read_table(base,key,*TABLES["schedules"]))
    ids={int(r["game_id"]) for r in observations if str(r.get("game_id","")).isdigit()}
    official,errors=collect_official(ids)
    identity_map=read_table(base,key,*TABLES["identityMap"])
    payload={"observations":observations,"schedules":schedules,"officialGames":official,"identityMap":identity_map}
    js="const fs=require('fs');const {compareHistoricalProjections}=require('./scripts/core43_historical_projection_join.cjs');const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(compareHistoricalProjections(input)));"
    proc=subprocess.run(["node","-e",js],input=json.dumps(payload),text=True,capture_output=True,check=True,timeout=60)
    result=json.loads(proc.stdout)
    result["generatedAt"]=datetime.now(timezone.utc).isoformat()
    result["sourceCounts"]={"observations":len(observations),"scheduleGames":len(schedules),"officialFinalGames":len(official),"identityMapEntries":len(identity_map),"officialFetchFailures":len(errors)}
    result["officialFetchErrors"]=errors
    result["historicalPredictionMutation"]=False
    output=Path(args.output)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print(json.dumps({"rowsCompared":result["rowsCompared"],"sourceCounts":result["sourceCounts"],"countsByLeadTime":result["countsByLeadTime"]}))
if __name__=="__main__":main()
