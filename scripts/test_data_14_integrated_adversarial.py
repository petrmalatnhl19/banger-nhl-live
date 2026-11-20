"""DATA-14.8 integrated adversarial regression suite: offline only."""
import copy
import unittest
from datetime import datetime, timezone
from scripts.data_14_source_selection_dry_run import dry_run_selection
from scripts.data_14_licensed_lineup_adapter import adapt_lineup
from scripts.data_14_multisource_gate import assess_candidate

NOW = datetime(2026, 11, 20, 15, tzinfo=timezone.utc)
POLICY = {"licensed_test": {"automaticReuseAuthorized": True,
                            "allowedHosts": ["data.example.org"]}}
GOOD = {
    "provider": "licensed_test", "sourceUrl": "https://data.example.org/lineups",
    "publishedAt": "2026-11-20T14:00:00Z", "team": "stars",
    "gameId": "2026020335", "rosterValidated": True,
    "forwards": [[f"F{i*3+j}" for j in range(3)] for i in range(4)],
    "defense": [[f"D{i*2+j}" for j in range(2)] for i in range(3)],
}


class IntegratedAdversarialTests(unittest.TestCase):
    def test_multiple_failure_types_never_switch(self):
        stale = {**GOOD, "publishedAt": "2026-11-17T14:00:00Z"}
        unlicensed = {**GOOD, "provider": "unknown"}
        incomplete = {**GOOD, "forwards": GOOD["forwards"][:2]}
        duplicate = copy.deepcopy(GOOD)
        duplicate["defense"][0][0] = duplicate["forwards"][0][0]
        invalid_host = {**GOOD, "sourceUrl": "https://data.example.org.evil.test/a"}
        original = {"stars": {"source": "https://www.nhl.com/example",
                              "publishedAt": "2026-11-19T12:00:00Z"}}
        before = copy.deepcopy(original)
        result = dry_run_selection(original,
                                   [stale, unlicensed, incomplete, duplicate, invalid_host],
                                   POLICY, now=NOW)
        self.assertEqual(result["evaluated"], 5)
        self.assertEqual(result["automaticallySwitched"], 0)
        self.assertEqual([x["candidateReason"] for x in result["results"]],
                         ["stale_or_future_projection", "reuse_not_authorized",
                          "incomplete_formation", "duplicate_player",
                          "provider_url_not_allowed"])
        self.assertTrue(all(x["selectedSource"] == "existing" for x in result["results"]))
        self.assertEqual(original, before)

    def test_valid_candidate_requires_review_and_is_not_published(self):
        original = {"stars": {"source": "https://www.nhl.com/example"}}
        result = dry_run_selection(original, [copy.deepcopy(GOOD)], POLICY, now=NOW)
        self.assertTrue(result["results"][0]["candidateAccepted"])
        self.assertEqual(result["results"][0]["recommendation"], "manual_review_required")
        self.assertFalse(result["results"][0]["autoSwitched"])
        self.assertEqual(original["stars"]["source"], "https://www.nhl.com/example")

    def test_missing_permission_blocks_even_perfect_candidate(self):
        self.assertEqual(adapt_lineup(GOOD, {}, now=NOW)["reason"], "reuse_not_authorized")

    def test_no_candidate_can_claim_confirmed_game(self):
        claim = {**GOOD, "gameConfirmed": True}
        result = dry_run_selection({}, [claim], POLICY, now=NOW)
        self.assertEqual(result["results"][0]["candidateReason"],
                         "unsupported_game_confirmation")

    def test_empty_and_bad_candidate_fail_closed(self):
        for bad in (None, {}, [], "invalid"):
            with self.subTest(bad=bad):
                result = dry_run_selection({}, [bad], POLICY, now=NOW)
                self.assertFalse(result["results"][0]["candidateAccepted"])
                self.assertFalse(result["results"][0]["autoSwitched"])


if __name__ == "__main__":
    unittest.main()
