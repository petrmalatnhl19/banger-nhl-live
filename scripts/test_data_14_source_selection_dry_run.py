import unittest
from datetime import datetime, timezone
from scripts.data_14_source_selection_dry_run import dry_run_selection

NOW = datetime(2026, 11, 20, 15, tzinfo=timezone.utc)
CANDIDATE = {"provider": "licensed_test", "sourceUrl": "https://data.example.org/lineups",
             "publishedAt": "2026-11-20T14:00:00Z", "team": "stars",
             "gameId": "2026020335", "rosterValidated": True,
             "forwards": [[f"F{i*3+j}" for j in range(3)] for i in range(4)],
             "defense": [[f"D{i*2+j}" for j in range(2)] for i in range(3)]}
POLICY = {"licensed_test": {"automaticReuseAuthorized": True, "allowedHosts": ["data.example.org"]}}


class SourceSelectionDryRunTests(unittest.TestCase):
    def test_valid_candidate_never_switches_existing_source(self):
        result = dry_run_selection({"stars": {"source": "https://www.nhl.com/a"}},
                                   [CANDIDATE], POLICY, now=NOW)
        self.assertEqual(result["automaticallySwitched"], 0)
        self.assertEqual(result["results"][0]["selectedSource"], "existing")
        self.assertEqual(result["results"][0]["recommendation"], "manual_review_required")

    def test_unlicensed_candidate_does_not_replace_existing(self):
        result = dry_run_selection({"stars": {"source": "https://www.nhl.com/a"}},
                                   [CANDIDATE], {}, now=NOW)
        self.assertFalse(result["results"][0]["candidateAccepted"])
        self.assertEqual(result["results"][0]["candidateReason"], "reuse_not_authorized")
        self.assertEqual(result["results"][0]["recommendation"], "no_change")

    def test_no_existing_record_still_does_not_publish(self):
        result = dry_run_selection({}, [CANDIDATE], POLICY, now=NOW)
        self.assertEqual(result["results"][0]["selectedSource"], "none")
        self.assertFalse(result["results"][0]["autoSwitched"])

    def test_empty_candidates(self):
        self.assertEqual(dry_run_selection({}, [], {}, now=NOW)["evaluated"], 0)


if __name__ == "__main__":
    unittest.main()
