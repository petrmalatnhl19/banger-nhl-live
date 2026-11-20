"""DATA-11 regression tests for goalie feed audit."""
import datetime
import unittest
from scripts.audit_data_11_goalie_feed import audit
NOW = datetime.datetime(2026, 11, 20, 12, tzinfo=datetime.timezone.utc)

def feed():
 return {"date":"2026-11-20","updatedAt":"2026-11-20T11:00:00+00:00","status":"partial",
         "teams":{"DAL":{"name":"Example Goalie","status":"projected","date":"2026-11-20","source":"https://example.org/goalies"}},
         "sourceErrors":[],"conflicts":[]}

class GoalieFeedAuditTests(unittest.TestCase):
 def test_fresh_projection_is_usable(self):
  self.assertEqual(audit(feed(),NOW)["usableTeams"],1)
 def test_empty_feed_is_not_usable(self):
  d=feed();d["teams"]={}
  self.assertIn("no_starter_projections",audit(d,NOW)["issues"])
 def test_stale_and_future_exports_are_not_usable(self):
  for stamp in ("2026-11-18T11:00:00+00:00","2026-11-21T11:00:00+00:00"):
   d=feed();d["updatedAt"]=stamp
   self.assertEqual(audit(d,NOW)["usableTeams"],0)
 def test_undocumented_confirmed_is_rejected(self):
  d=feed();d["teams"]["DAL"]["status"]="confirmed"
  self.assertEqual(audit(d,NOW)["usableTeams"],0)
 def test_wrong_date_is_rejected(self):
  d=feed();d["teams"]["DAL"]["date"]="2026-11-19"
  self.assertEqual(audit(d,NOW)["usableTeams"],0)
 def test_source_errors_are_reported(self):
  d=feed();d["sourceErrors"]=["specialist unavailable"]
  self.assertIn("source_failures",audit(d,NOW)["issues"])
if __name__=="__main__":
 unittest.main()
