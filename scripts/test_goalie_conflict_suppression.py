"""Regression tests for fail-closed RotoWire publishing decisions."""
import datetime
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from scripts import publish_rotowire_goalies as publisher


class GoalieConflictSuppressionTests(unittest.TestCase):
    def run_case(self, existing, incoming):
        today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
        incoming = {"date": today, "team": "DAL", "gameId": 2026020001,
                    "goalie": "Goalie B", "status": "confirmed", **incoming}
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            fixtures = {
                "rotowire_goalies_diagnostic.json": {"matchedCount": 10,
                    "source": "https://example.org/goalies", "matches": [incoming]},
                "nhl_rosters.json": {"teams": {"stars": {"abbrev": "DAL",
                    "goalies": ["Goalie A", "Goalie B"], "playerIds": {}}}},
                "starting_goalies.json": {"date": today, "teams": {"DAL": {
                    "name": "Goalie A", "date": today, "status": "projected",
                    **existing}}, "conflicts": []},
            }
            for name, data in fixtures.items():
                (root / name).write_text(json.dumps(data), encoding="utf-8")
            with patch.object(publisher, "ROOT", root):
                publisher.main()
            return json.loads((root / "starting_goalies.json").read_text(encoding="utf-8"))

    def test_conflicting_confirmed_incoming_does_not_override_projection(self):
        output = self.run_case({}, {"confirmationBasis": "explicit_pregame_report",
                                    "confirmationEvidence": "https://example.org/evidence"})
        self.assertNotIn("DAL", output["teams"])
        self.assertTrue(any(c.get("team") == "DAL" for c in output["conflicts"]))

    def test_unsupported_confirmed_label_does_not_override_projection(self):
        output = self.run_case({}, {})
        self.assertNotIn("DAL", output["teams"])

    def test_previous_evidenced_confirmation_is_preserved(self):
        output = self.run_case({"status": "confirmed", "confirmationBasis": "explicit_pregame_report",
                                "confirmationEvidence": "https://example.org/previous"}, {})
        self.assertEqual(output["teams"]["DAL"]["name"], "Goalie A")
        self.assertEqual(output["teams"]["DAL"]["status"], "confirmed")


if __name__ == "__main__":
    unittest.main()
