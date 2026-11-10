"""Conflicting confirmed starter reports must not enter CORE 4.3."""
import unittest
from scripts.ingest_core43_starter_feed import reject_conflicting_starters


class ConflictingStarterTests(unittest.TestCase):
    def test_conflicting_goalies_reject_both(self):
        rows=[{"game_id":1,"team_code":"DAL","goalie_id":"100"},
              {"game_id":1,"team_code":"DAL","goalie_id":"200"},
              {"game_id":1,"team_code":"NJD","goalie_id":"300"}]
        accepted, conflicts=reject_conflicting_starters(rows)
        self.assertEqual(accepted,[rows[2]])
        self.assertEqual(conflicts,{(1,"DAL")})

    def test_multiple_sources_same_goalie_are_allowed(self):
        rows=[{"game_id":1,"team_code":"DAL","goalie_id":"100"},
              {"game_id":1,"team_code":"DAL","goalie_id":"100"}]
        accepted, conflicts=reject_conflicting_starters(rows)
        self.assertEqual(accepted,rows)
        self.assertFalse(conflicts)

    def test_games_are_independent(self):
        rows=[{"game_id":1,"team_code":"DAL","goalie_id":"100"},
              {"game_id":2,"team_code":"DAL","goalie_id":"200"}]
        accepted, conflicts=reject_conflicting_starters(rows)
        self.assertEqual(accepted,rows)
        self.assertFalse(conflicts)


if __name__ == "__main__":
    unittest.main()
