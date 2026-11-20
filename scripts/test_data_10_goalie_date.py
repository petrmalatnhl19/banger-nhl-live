"""DATA-10: dated source recognition must reject stale and ambiguous pages."""
import datetime
import unittest
from scripts.update_starting_goalies import source_shows_date

class SourceDateTests(unittest.TestCase):
 def setUp(self):
  self.day=datetime.date(2026,11,20)
 def test_supported_explicit_formats(self):
  for date in ("2026-11-20","November 20, 2026","Nov 20, 2026","Nov. 20, 2026","20 November 2026","20 Nov 2026","November 20th, 2026"):
   with self.subTest(date=date):
    self.assertTrue(source_shows_date(["Starting goalies",date],self.day))
 def test_rejects_old_or_future_and_ambiguous(self):
  for date in ("2026-11-19","2026-11-21","November 19, 2026","Nov 21, 2026","November 20","2026-11-200","2026-11-201"):
   with self.subTest(date=date):
    self.assertFalse(source_shows_date(["Starting goalies",date],self.day))
 def test_date_must_appear_near_top(self):
  self.assertFalse(source_shows_date(["line"]*151+["2026-11-20"],self.day))
if __name__=="__main__":
 unittest.main()
