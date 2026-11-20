"""DATA-12: source diagnostics must distinguish stale/undated pages and outages."""
import unittest
import urllib.error
from scripts.update_starting_goalies import source_failure_kind, specialist_page_health
import datetime
class SourceFailureTests(unittest.TestCase):
 def test_undated_page(self):
  self.assertEqual(source_failure_kind(ValueError("Source does not show today's date")),"missing_current_date")
 def test_empty_visible_page(self):
  self.assertEqual(specialist_page_health([],datetime.date(2026,11,20)),"empty_visible_page")
  self.assertEqual(source_failure_kind(ValueError("Source has no visible content")),"empty_visible_page")
 def test_dated_but_no_goalie_rows(self):
  self.assertEqual(specialist_page_health(["November 20, 2026"],datetime.date(2026,11,20)),"dated_page")
 def test_connection_failure(self):
  self.assertEqual(source_failure_kind(urllib.error.URLError("offline")),"source_unreachable")
 def test_timeout(self):
  self.assertEqual(source_failure_kind(TimeoutError("timeout")),"source_unreachable")
 def test_processing_error(self):
  self.assertEqual(source_failure_kind(ValueError("unexpected structure")),"source_processing_error")
 def test_content_error(self):
  self.assertEqual(source_failure_kind(UnicodeError("decode")),"invalid_source_content")
if __name__=="__main__":
 unittest.main()
