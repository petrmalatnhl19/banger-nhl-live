"""DATA-14: offline coverage audit regression tests."""
import unittest
from scripts.data_14_lineup_freshness_audit import audit


class FreshnessAuditTests(unittest.TestCase):
    def test_recovery_rejection_is_preserved_without_auto_approval(self):
        coverage = {"teams": {"bruins": {"hasProjectedLines": True, "currentProjection": False}}}
        recovery = {"teams": [{"team": "bruins", "missingForwardLines": 1,
            "missingDefensePairs": 0, "reason": "rejected_roster_lines",
            "rejectedLines": [{"sourceLine": ["Player A", "Player B", "Player C"]}],
            "nextAction": "Verify official roster"}]}
        result = audit(coverage, {"teams": {}}, recovery)
        team = result["teams"][0]
        self.assertEqual(team["recoveryReason"], "rejected_roster_lines")
        self.assertEqual(team["missingForwardLines"], 1)
        self.assertEqual(len(team["rejectedLines"]), 1)
        self.assertFalse(team["confirmedNextGame"])

    def test_recovery_is_optional(self):
        result = audit({"teams": {"stars": {"hasProjectedLines": True,
            "currentProjection": True}}}, {"teams": {}})
        self.assertIsNone(result["teams"][0]["missingForwardLines"])

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
