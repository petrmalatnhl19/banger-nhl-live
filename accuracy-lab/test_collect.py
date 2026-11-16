import copy
from datetime import date
import unittest

from collect import actual_start, instant, normalize, selection


def example(ending):
    return {
        "id": 2026020327, "gameDate": "2026-11-15", "gameType": 2,
        "gameState": "OFF", "startTimeUTC": "2026-11-16T01:00:00Z", "venueUTCOffset": "-06:00",
        "awayTeam": {"abbrev": "FLA", "id": 1, "score": 1},
        "homeTeam": {"abbrev": "DAL", "id": 2, "score": 2},
        "periodDescriptor": {"periodType": ending}, "gameOutcome": {"lastPeriodType": ending},
        "playerByGameStats": {"homeTeam": {"goalies": [
            {"playerId": 8479193, "name": {"default": "DeSmith"}, "starter": True, "toi": "62:56"},
            {"playerId": 8479979, "name": {"default": "Oettinger"}, "starter": False, "toi": "00:00"},
        ]}},
    }


class NHLCollectionTests(unittest.TestCase):
    def test_regulation_and_played_goals(self):
        for ending, regulation, played in (("REG", 2, 2), ("OT", 1, 2), ("SO", 1, 1)):
            row = normalize(example(ending), example(ending))
            self.assertEqual(row["regulation"]["home"], regulation)
            self.assertEqual(row["playedGoals"]["home"], played)
            self.assertEqual(row["postgameGoalies"]["home"]["starterId"], 8479193)
            self.assertEqual(len(row["postgameGoalies"]["home"]["participants"]), 1)

    def test_rejects_disagreements_and_impossible_extra_time(self):
        score, box = example("OT"), example("OT")
        box["awayTeam"]["score"] = 0
        with self.assertRaisesRegex(ValueError, "disagree"):
            normalize(score, box)
        score["awayTeam"]["score"] = 0
        with self.assertRaisesRegex(ValueError, "tied"):
            normalize(score, box)

    def test_verifies_official_start_header_and_timezone(self):
        html = """
            <table id="Visitor"><td>logocFLA.gif</td></table>
            <table id="GameInfo"><td>Game Summary</td><td>Final</td><td>Game 0327</td>
              <td>Sunday, November 15, 2026</td><td>Start&nbsp;7:08&nbsp;CST; End&nbsp;9:42&nbsp;CST</td></table>
            <table id="Home"><td>logocDAL.gif</td></table>"""
        box = example("OT")
        self.assertEqual(actual_start(html, box), "2026-11-16T01:08:00+00:00")
        self.assertEqual(actual_start(html.replace("CST", "ABT"), box), "2026-11-16T01:08:00+00:00")
        for changed in (html.replace("FLA", "ANA"), html.replace("CST", "PST"),
                        html.replace("November 15", "November 16")):
            with self.assertRaises(ValueError):
                actual_start(changed, box)

    def test_sample_order_and_duplicate_conflicts(self):
        score = example("OT")
        earlier = copy.deepcopy(score)
        earlier["id"] -= 1
        games = [score, earlier, copy.deepcopy(score)]
        fetch = lambda _: {"games": games}
        cutoff = instant("2026-11-16T03:00:00Z")
        chosen = selection(date(2026, 11, 15), 1, 2, cutoff, fetch)
        self.assertEqual([row["id"] for row in chosen], [score["id"], earlier["id"]])
        games[-1]["homeTeam"]["score"] += 1
        with self.assertRaisesRegex(ValueError, "conflicting"):
            selection(date(2026, 11, 15), 1, 2, cutoff, fetch)
