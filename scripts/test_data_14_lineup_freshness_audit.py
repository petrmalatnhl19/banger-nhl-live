"""DATA-14: offline coverage audit regression tests."""
import unittest
from scripts.data_14_lineup_freshness_audit import audit


class FreshnessAuditTests(unittest.TestCase):
    def test_stale_projection_is_not_confirmed(self):
        result = audit({"teams": {"bruins": {"hasProjectedLines": True, "currentProjection": False}}},
                       {"teams": {"bruins": {"validatedForwardLines": 4, "validatedDefensePairs": 3}}})
        self.assertEqual(result["needsFreshProjection"], 1)
        self.assertFalse(result["teams"][0]["confirmedNextGame"])

    def test_missing_lineup_is_reported(self):
        result = audit({"teams": {"stars": {"hasProjectedLines": False}}}, {"teams": {}})
        self.assertEqual(result["missingProjection"], 1)

    def test_partial_forward_lineup_is_not_complete(self):
        result = audit({"teams": {"jets": {"hasProjectedLines": True, "currentProjection": True}}},
                       {"teams": {"jets": {"validatedForwardLines": 3, "validatedDefensePairs": 3}}})
        self.assertEqual(result["incompleteForwards"], 1)

    def test_recent_full_projection_is_not_a_confirmed_next_game_lineup(self):
        result = audit({"teams": {"stars": {"hasProjectedLines": True, "currentProjection": True}}},
                       {"teams": {"stars": {"validatedForwardLines": 4, "validatedDefensePairs": 3}}})
        self.assertEqual(result["teams"][0]["reason"], "recent_projection_not_game_confirmation")
        self.assertFalse(result["teams"][0]["confirmedNextGame"])


if __name__ == "__main__":
    unittest.main()
