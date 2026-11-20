"""Offline DATA-13 game identity regression cases."""
import unittest
import subprocess
import sys
from pathlib import Path
from scripts.data_13_game_identity import validate_game_claims, reconcile_source_claims

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

    def test_ambiguous_schedule_id(self):
        accepted, issues = validate_game_claims([CLAIM], GAME + [{**GAME[0], "away": "BOS"}])
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "ambiguous_game")

    def test_unknown_status(self):
        accepted, issues = validate_game_claims([{**CLAIM, "status": "unknown"}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "invalid_status")

    def test_missing_goalie(self):
        accepted, issues = validate_game_claims([{**CLAIM, "goalie": ""}], GAME)
        self.assertFalse(accepted)
        self.assertEqual(issues[0]["reason"], "missing_goalie")

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


class ScriptImportTests(unittest.TestCase):
    def test_direct_script_imports(self):
        root = Path(__file__).resolve().parent.parent
        for script in ("parse_rotowire_goalies", "publish_rotowire_goalies"):
            with self.subTest(script=script):
                result = subprocess.run(
                    [sys.executable, "-c",
                     "import sys; sys.path.insert(0, 'scripts'); import " + script],
                    cwd=root, capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode, 0, result.stderr)


class PublisherIntegrationTests(unittest.TestCase):
    def test_publisher_reconciles_matching_game_claims(self):
        source = (Path(__file__).with_name("publish_rotowire_goalies.py")).read_text(encoding="utf-8")
        self.assertIn("reconcile_source_claims([previous, incoming])", source)
        self.assertIn('existing.get("gameId") is not None', source)
        self.assertIn('"cross_source_" + reason', source)

    def test_publisher_keeps_confirmation_basis(self):
        source = (Path(__file__).with_name("publish_rotowire_goalies.py")).read_text(encoding="utf-8")
        self.assertIn('"confirmationBasis": item["confirmationBasis"]', source)


class CrossSourceTests(unittest.TestCase):
    def test_sources_disagree_on_goalie(self):
        accepted, reason = reconcile_source_claims([CLAIM, {**CLAIM, "goalie": "Other"}])
        self.assertIsNone(accepted)
        self.assertEqual(reason, "conflicting_goalies")

    def test_unsupported_confirmation_is_only_projection(self):
        accepted, reason = reconcile_source_claims([CLAIM, {**CLAIM, "status": "confirmed"}])
        self.assertIsNone(reason)
        self.assertEqual(accepted["status"], "projected")

    def test_evidenced_confirmation_survives_projection(self):
        confirmed = {**CLAIM, "status": "confirmed",
                     "confirmationBasis": "explicit_pregame_report",
                     "confirmationEvidence": "Explicit pregame starter report"}
        accepted, reason = reconcile_source_claims([CLAIM, confirmed])
        self.assertIsNone(reason)
        self.assertEqual(accepted["status"], "confirmed")
        self.assertEqual(accepted["confirmationEvidence"], confirmed["confirmationEvidence"])

    def test_conflicting_games_are_rejected(self):
        accepted, reason = reconcile_source_claims([CLAIM, {**CLAIM, "gameId": 124}])
        self.assertIsNone(accepted)
        self.assertEqual(reason, "different_games")

    def test_empty_evidence_does_not_confirm(self):
        accepted, reason = reconcile_source_claims([{**CLAIM, "status": "confirmed",
            "confirmationBasis": "explicit_pregame_report", "confirmationEvidence": "  "}])
        self.assertIsNone(reason)
        self.assertEqual(accepted["status"], "projected")

if __name__ == "__main__":
    unittest.main()
