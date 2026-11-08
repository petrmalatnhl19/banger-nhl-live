import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

spec = importlib.util.spec_from_file_location("audit", Path(__file__).with_name("audit_official_final_goalies.py"))
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

class FinalGoaliesTest(unittest.TestCase):
    def test_final_and_explicit_starter(self):
        box = {"gameState": "OFF", "gameDate": "2026-11-07",
               "awayTeam": {"abbrev": "DAL"}, "homeTeam": {"abbrev": "BOS"},
               "playerByGameStats": {
                   "awayTeam": {"goalies": [{"playerId": 101, "name": {"default": "Goalie A"}, "starter": True, "toi": "60:00"}]},
                   "homeTeam": {"goalies": [{"playerId": 202, "starter": True}]}}}
        result = audit.final_goalies(box)
        self.assertEqual(result["awayTeam"]["startingGoalieId"], 101)
        self.assertTrue(result["homeTeam"]["starterVerified"])
        self.assertIsNone(audit.final_goalies({**box, "gameState": "LIVE"}))
        box["playerByGameStats"]["awayTeam"]["goalies"][0].pop("starter")
        self.assertIsNone(audit.final_goalies(box)["awayTeam"]["startingGoalieId"])

    def test_collection_does_not_modify_predictions(self):
        now = datetime(2026, 11, 8, tzinfo=timezone.utc)
        def fake(path):
            if path.startswith("schedule/"):
                return {"gameWeek": [{"games": [{"id": 42, "gameType": 2, "startTimeUTC": "2026-11-07T20:00:00Z"}]}]}
            return {"gameState": "OFF", "gameDate": "2026-11-07",
                    "awayTeam": {"abbrev": "DAL"}, "homeTeam": {"abbrev": "BOS"},
                    "playerByGameStats": {"awayTeam": {"goalies": []}, "homeTeam": {"goalies": []}}}
        result = audit.collect(days=2, now=now, fetch=fake)
        self.assertEqual(result["summary"]["finalGames"], 1)
        self.assertEqual(result["summary"]["withBothVerifiedStarters"], 0)
        self.assertFalse(result["historicalPredictionMutation"])

if __name__ == "__main__":
    unittest.main()
