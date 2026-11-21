import unittest
from scripts.data_14_multisource_gate import assess_candidate, source_readiness

BASE = {"provider": "nhl.com", "sourceUrl": "https://www.nhl.com/news/example",
        "publishedAt": "2026-11-20T10:00:00Z", "rosterValidated": True,
        "forwardLines": 4, "defensePairs": 3}


class MultiSourceGateTests(unittest.TestCase):
    def test_nhl_requires_explicit_reuse_authorization(self):
        self.assertEqual(assess_candidate(BASE)["reason"], "reuse_not_authorized")

    def test_validated_nhl_projection_is_not_game_confirmation(self):
        result = assess_candidate(BASE, {"nhl.com": {"automaticReuseAuthorized": True}})
        self.assertTrue(result["accepted"])
        self.assertFalse(result["confirmedNextGame"])

    def test_third_party_is_blocked_without_reuse_permission(self):
        for provider in ("fantasy_roundup", "between_the_lines"):
            with self.subTest(provider=provider):
                self.assertEqual(assess_candidate({**BASE, "provider": provider})["reason"], "reuse_not_authorized")

    def test_unknown_source_is_blocked(self):
        self.assertEqual(assess_candidate({**BASE, "provider": "unknown"})["reason"], "unknown_provider")

    def test_incomplete_formation_is_blocked(self):
        self.assertEqual(assess_candidate({**BASE, "forwardLines": 3}, {"nhl.com": {"automaticReuseAuthorized": True}})["reason"], "incomplete_formation")

    def test_unverified_roster_is_blocked(self):
        self.assertEqual(assess_candidate({**BASE, "rosterValidated": False}, {"nhl.com": {"automaticReuseAuthorized": True}})["reason"], "roster_not_validated")

    def test_fake_nhl_domain_is_blocked(self):
        self.assertEqual(assess_candidate({**BASE, "sourceUrl": "https://nhl.com.attacker.test/a"}, {"nhl.com": {"automaticReuseAuthorized": True}})["reason"], "provider_url_mismatch")

    def test_game_confirmation_is_not_inferred(self):
        self.assertEqual(assess_candidate({**BASE, "gameConfirmed": True}, {"nhl.com": {"automaticReuseAuthorized": True}})["reason"], "unsupported_game_confirmation")

    def test_source_readiness_keeps_probe_separate_from_authorization(self):
        report = {"sources": {"fantasy_roundup": {"reachable": True, "usedTeams": 0, "automaticReuseAuthorized": False}}}
        self.assertFalse(source_readiness(report)["fantasy_roundup"]["canAutoPublish"])


if __name__ == "__main__":
    unittest.main()
