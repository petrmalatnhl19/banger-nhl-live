"""DATA-12 source-health summary must not treat HTTP success as verified starters."""
import unittest
from scripts.data_12_source_health_report import summarize
class SourceHealthReportTests(unittest.TestCase):
 def test_http_success_is_not_starter_evidence(self):
  report=summarize({"status":"unavailable","teams":{}},{"results":[{"source":"rotowire","ok":True}]})
  self.assertEqual(report["publishedTeams"],0)
  self.assertEqual(report["sourceConnectivity"][0]["usableStarterClaims"],"not_assessed")
 def test_projected_and_confirmed_are_distinct(self):
  report=summarize({"teams":{"DAL":{"status":"projected"},"BOS":{"status":"confirmed"}}})
  self.assertEqual((report["publishedProjected"],report["publishedConfirmed"]),(1,1))
 def test_missing_diagnostic_does_not_claim_matches(self):
  self.assertEqual(summarize({})["rotowireScheduleMatchedCandidates"],"not_assessed")
if __name__=="__main__":
 unittest.main()
