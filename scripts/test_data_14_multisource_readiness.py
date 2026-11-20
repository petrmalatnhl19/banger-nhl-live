import unittest
from scripts.data_14_multisource_readiness import build_report


class MultiSourceReadinessTests(unittest.TestCase):
    def test_reachable_third_party_stays_blocked(self):
        usage = {"sources": {
            "nhl.com": {"usedTeams": 32},
            "fantasy_roundup": {"usedTeams": 0, "reachable": True, "automaticReuseAuthorized": False}}}
        result = build_report(usage, {"teams": []}, {"teams": {}})
        self.assertEqual(result["sourceReadiness"]["fantasy_roundup"]["status"],
                         "blocked_pending_reuse_permission")
        self.assertFalse(result["thirdPartyContentImported"])

    def test_stale_rejected_team_is_prioritized(self):
        coverage = {"teams": {"bruins": {"hasProjectedLines": True, "currentProjection": False},
                              "stars": {"hasProjectedLines": True, "currentProjection": True}}}
        recovery = {"teams": [
            {"team": "stars", "missingForwardLines": 1, "rejectedLines": []},
            {"team": "bruins", "missingForwardLines": 1,
             "rejectedLines": [{"sourceLine": ["Example"]}]},
        ]}
        result = build_report({}, recovery, coverage)
        self.assertEqual(result["prioritizedRecovery"][0]["team"], "bruins")
        self.assertTrue(result["prioritizedRecovery"][0]["requiresIndependentEvidence"])
        self.assertEqual(result["staleTeams"], 1)

    def test_missing_reports_are_safe(self):
        result = build_report({}, {}, {})
        self.assertEqual(result["incompleteTeams"], 0)
        self.assertEqual(result["staleTeams"], 0)


if __name__ == "__main__":
    unittest.main()
