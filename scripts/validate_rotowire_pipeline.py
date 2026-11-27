"""Read public NHL/RotoWire sources; simulate all writes in a temporary directory."""
import datetime as dt
import io
import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch
from scripts import parse_rotowire_goalies as parser
from scripts import publish_rotowire_goalies as publisher
from scripts import ingest_core43_starter_feed as importer

def main():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        for name in ("nhl_rosters.json", "starting_goalies.json"):
            (root / name).write_bytes((parser.ROOT / name).read_bytes())
        with patch.object(parser, "ROOT", root), patch.object(publisher, "ROOT", root):
            parser.main()
            publisher.main()
        raw = json.loads((root / "rotowire_goalies.json").read_text())
        confirmed = [r for r in raw["games"] if r["status"] == "confirmed"]
        schedule = json.loads(parser.load("https://api-web.nhle.com/v1/schedule/" + dt.datetime.now(dt.timezone.utc).date().isoformat()))
        games = {g["id"]: g for day in schedule["gameWeek"] for g in day["games"]}
        snapshots = [{"game_id": g["id"], "home_team": g["homeTeam"]["abbrev"], "away_team": g["awayTeam"]["abbrev"], "kickoff_at": g["startTimeUTC"]} for g in games.values()]
        for row in confirmed:
            team = row["team"]
            roster = json.loads(parser.load("https://api-web.nhle.com/v1/roster/" + team + "/current"))
            matches = [p for p in roster["goalies"] if str(p["id"]) == str(row.get("goalieId")) and parser.norm(p["firstName"]["default"] + " " + p["lastName"]["default"]) == parser.norm(row["goalie"])]
            game = games[row["gameId"]]
            side = "homeTeam" if row["venue"] == "home" else "awayTeam"
            other = "awayTeam" if side == "homeTeam" else "homeTeam"
            assert len(matches) == 1 and game[side]["abbrev"] == team and game[other]["abbrev"] == row["opponent"] and game["startTimeUTC"] == row["startTimeUTC"], row
            print("NHL identity verified", row["goalie"], row["goalieId"], team, row["gameId"])
        captured = []
        class Response(io.BytesIO):
            status = 201
        def fake_open(request, timeout=None):
            if request.get_method() == "POST" and request.full_url.startswith("https://isolated.supabase.co/rest/v1/nhl_core43_starter_evidence?"):
                captured.extend(json.loads(request.data))
                return Response(b"")
            raise AssertionError("Unexpected simulated request")
        previous = Path.cwd()
        try:
            os.chdir(root)
            with patch.dict(os.environ, {"SUPABASE_URL":"https://isolated.supabase.co","SUPABASE_SERVICE_ROLE_KEY":"dummy","CORE43_STARTER_FEED_URL":"","CORE43_STARTER_FEED_TOKEN":""}), patch.object(importer,"fetch_schedule_snapshots",return_value=snapshots), patch.object(importer.urllib.request,"urlopen",side_effect=fake_open):
                importer.main()
        finally:
            os.chdir(previous)
        expected = {(r["gameId"],r["team"],str(r["goalieId"])) for r in confirmed}
        actual = {(r["game_id"],r["team_code"],r["goalie_id"]) for r in captured}
        assert expected == actual, (expected, actual)
        print(json.dumps({"verified":len(expected),"simulated_import":len(captured),"production_writes":0,"live_evidence_present":bool(expected)}))
        if not expected:
            print("::warning::No live confirmed candidates; integration evidence remains inconclusive")

if __name__ == "__main__":
    main()
