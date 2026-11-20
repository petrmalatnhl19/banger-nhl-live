"""Offline DATA-13 game identity regression cases."""
import unittest
from scripts.data_13_game_identity import validate_game_claims

GAME = [{"gameId": 123, "date": "2026-11-21", "home": "DAL", "away": "VGK"}]
CLAIM = {"gameId": 123, "date": "2026-11-21", "team": "DAL", "opponent": "VGK", "venue": "home", "goalie": "Example Goalie", "status": "projected"}

class GameIdentityTests(unittest.TestCase):
    def test_duplicate_same_claim_collapses(self):
        accepted, issues = validate_game_claims([CLAIM, dict(CLAIM)], GAME)
        self.assertEqual(len(accepted), 1)
        self.assertFalse(issues)

    def test_wrong_venue(self):
        accepted, issues = validate_game_claims([{**CLAIM, "venue": "away"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "game_identity_mismatch")

    def test_correct_game(self):
        accepted, issues = validate_game_claims([CLAIM], GAME)
        self.assertEqual(len(accepted), 1)
        self.assertFalse(issues)

    def test_wrong_date(self):
        accepted, issues = validate_game_claims([{**CLAIM, "date": "2026-11-22"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "game_identity_mismatch")

    def test_wrong_opponent(self):
        accepted, issues = validate_game_claims([{**CLAIM, "opponent": "BOS"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "game_identity_mismatch")

    def test_unknown_game(self):
        accepted, issues = validate_game_claims([{**CLAIM, "gameId": 999}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "unknown_game")

    def test_conflicting_goalies(self):
        accepted, issues = validate_game_claims([CLAIM, {**CLAIM, "goalie": "Another Goalie"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "conflicting_goalies")

    def test_conflicting_status(self):
        accepted, issues = validate_game_claims([CLAIM, {**CLAIM, "status": "confirmed"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "conflicting_status")

if __name__ == "__main__":
    unittest.main()
