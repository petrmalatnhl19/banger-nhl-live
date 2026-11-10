"""Regression coverage for CORE 4.3 goalie identity validation."""
import unittest
from scripts.ingest_core43_starter_feed import valid_nhl_goalie_id


class GoalieIdValidationTests(unittest.TestCase):
    def test_numeric_nhl_id_string(self):
        self.assertTrue(valid_nhl_goalie_id("8479979"))

    def test_numeric_nhl_id_integer(self):
        self.assertTrue(valid_nhl_goalie_id(8479979))

    def test_reject_invalid_identifiers(self):
        for value in (None, "", "unknown", "8479979x", " 8479979", True, False, -1):
            with self.subTest(value=value):
                self.assertFalse(valid_nhl_goalie_id(value))


if __name__ == "__main__":
    unittest.main()
