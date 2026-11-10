import importlib.util
import unittest
from unittest.mock import patch
import io
import json
from pathlib import Path
spec=importlib.util.spec_from_file_location("runner",Path(__file__).with_name("run_core43_historical_projection_audit.py"))
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
class RunnerTests(unittest.TestCase):
 def test_identity_map_uses_valid_order_column(self):
  class FakeResponse:
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self,*args):return b'[]'
  def fake_urlopen(request,timeout):
   self.assertIn("order=goalie_id.asc",request.full_url)
   self.assertNotIn("order=game_id.asc",request.full_url)
   return FakeResponse()
  with patch.object(runner.urllib.request,"urlopen",side_effect=fake_urlopen):
   self.assertEqual(runner.read_table("https://example.supabase.co","test","nhl_core43_goalie_identity_map","goalie_id,goalie_name",order_by="goalie_id"),[])
 def test_latest_pregame_schedule(self):
  rows=[
   {"game_id":42,"kickoff_at":"2026-11-09T20:00:00Z","fetched_at":"2026-11-09T18:00:00Z","away_team":"DAL","home_team":"NJD"},
   {"game_id":42,"kickoff_at":"2026-11-09T20:00:00Z","fetched_at":"2026-11-09T21:00:00Z","away_team":"DAL","home_team":"NJD"},
   {"game_id":42,"kickoff_at":"2026-11-09T20:00:00Z","fetched_at":"2026-11-09T19:00:00Z","away_team":"DAL","home_team":"NJD"}]
  result=runner.latest_schedule(rows)
  self.assertEqual(len(result),1)
  self.assertEqual(result[0]["fetched_at"],"2026-11-09T19:00:00Z")
 def test_only_official_final_games(self):
  def fetch(path):
   game=int(path.split("/")[1])
   if game==1:return {"gameState":"LIVE"}
   return {"gameState":"OFF","awayTeam":{"abbrev":"DAL"},"homeTeam":{"abbrev":"NJD"},
    "playerByGameStats":{"awayTeam":{"goalies":[{"playerId":10,"starter":True,"name":{"default":"Goalie One"}}]},
    "homeTeam":{"goalies":[]}}}
  games,errors=runner.collect_official({1,2},fetch)
  self.assertEqual(len(games),1)
  self.assertEqual(games[0]["away"]["startingGoalieId"],10)
  self.assertFalse(errors)
if __name__=="__main__":unittest.main()
