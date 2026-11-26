import importlib.util
import unittest
from unittest.mock import patch
import io
import json
import urllib.parse
from pathlib import Path
spec=importlib.util.spec_from_file_location("runner",Path(__file__).with_name("run_core43_historical_projection_audit.py"))
runner=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
class RunnerTests(unittest.TestCase):
 def test_identity_map_uses_valid_order_column(self):
  class FakeResponse:
   headers={"Content-Range":"*/0"}
   def __enter__(self):return self
   def __exit__(self,*args):return False
   def read(self,*args):return b'[]'
  def fake_urlopen(request,timeout):
   self.assertIn("order=goalie_id.asc",request.full_url)
   self.assertNotIn("order=game_id.asc",request.full_url)
   return FakeResponse()
  with patch.object(runner.urllib.request,"urlopen",side_effect=fake_urlopen):
   self.assertEqual(runner.read_table("https://example.supabase.co","test","nhl_core43_goalie_identity_map","goalie_id,goalie_name",order_by="goalie_id"),[])
 def test_pagination_beyond_old_cap_and_short_pages(self):
  self.assertEqual(len(self.read_pages(20501, page_size=317)),20501)
 def test_exact_multiple(self):
  self.assertEqual(len(self.read_pages(1000)),1000)
 def test_count_changes(self):
  with self.assertRaisesRegex(ValueError,"changed during pagination"):
   self.read_pages(1000, change_count=True)
 def test_duplicate_page(self):
  with self.assertRaisesRegex(ValueError,"Duplicate historical row"):
   self.read_pages(1000, duplicate=True)
 def test_premature_empty(self):
  with self.assertRaisesRegex(ValueError,"premature empty"):
   self.read_pages(1000, premature=True)
 def test_missing_count(self):
  with self.assertRaisesRegex(ValueError,"Missing exact"):
   self.read_pages(1000, missing_count=True)
 def read_pages(self,total,page_size=500,change_count=False,duplicate=False,premature=False,missing_count=False):
  calls=[]
  def fake_urlopen(request,timeout):
   params=urllib.parse.parse_qs(urllib.parse.urlsplit(request.full_url).query)
   start=int(params["offset"][0])
   self.assertEqual(start,sum(calls))
   self.assertEqual(params["order"],["game_id.asc.nullslast,observed_at.asc.nullslast"])
   self.assertEqual(request.get_header("Prefer"),"count=exact")
   end=min(start+page_size,total)
   batch=[{"game_id":i//1000,"observed_at":str(i)} for i in range(start,end)]
   if duplicate and start:batch[0]={"game_id":0,"observed_at":"0"}
   if premature and start:batch=[]
   count=total+int(change_count and start>0)
   interval=f"{start}-{start+len(batch)-1}" if batch else "*"
   response=io.BytesIO(json.dumps(batch).encode())
   response.headers={"Content-Range":f"{interval}/{count}"} if not missing_count else {}
   calls.append(len(batch))
   return response
  with patch.object(runner.urllib.request,"urlopen",side_effect=fake_urlopen):
   return runner.read_table("https://example.supabase.co","test","observations","game_id,observed_at")
 def test_stable_cutoff_and_same_count_replacement(self):
  first=[{"game_id":1,"observed_at":"2026-11-01T00:00:00Z"}]
  second=[{"game_id":2,"observed_at":"2026-11-01T00:00:00Z"}]
  cutoff="2026-11-26T20:00:00+00:00"
  with patch.object(runner,"read_table",side_effect=[first,second]) as read:
   with self.assertRaisesRegex(ValueError,"changed between verification"):
    runner.read_stable_table("https://example.supabase.co","test","observations","game_id,observed_at",cutoff,"observed_at")
   self.assertEqual(read.call_count,2)
   for call in read.call_args_list:
    self.assertEqual(call.kwargs["cutoff"],cutoff)
    self.assertEqual(call.kwargs["time_field"],"observed_at")
  with patch.object(runner,"read_table",side_effect=[first,first]):
   self.assertEqual(runner.read_stable_table("https://example.supabase.co","test","observations","game_id,observed_at",cutoff,"observed_at"),first)
 def test_cutoff_sent_to_server(self):
  cutoff="2026-11-26T20:00:00+00:00"
  def fake_urlopen(request,timeout):
   params=urllib.parse.parse_qs(urllib.parse.urlsplit(request.full_url).query)
   self.assertEqual(params["observed_at"],["lt."+cutoff])
   response=io.BytesIO(b"[]")
   response.headers={"Content-Range":"*/0"}
   return response
  with patch.object(runner.urllib.request,"urlopen",side_effect=fake_urlopen):
   self.assertEqual(runner.read_table("https://example.supabase.co","test","observations","game_id,observed_at",cutoff=cutoff,time_field="observed_at"),[])
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
