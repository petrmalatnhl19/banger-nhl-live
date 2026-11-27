import unittest
from datetime import datetime
from scripts.parse_rotowire_goalies import match_report

class ConfirmationTests(unittest.TestCase):
    def setUp(self):
        self.row = dict(goalie="Example Allen", status="confirmed", venue="home",
                        date="2026-11-27", startTimeUTC="2026-11-27T20:00:00Z")
        self.article = dict(about={"name": "Example Allen"},
                            datePublished="2026-11-27T15:00:00Z",
                            dateModified="2026-11-27T15:00:00Z")
        self.observed = datetime.fromisoformat("2026-11-27T16:00:00Z")
    def check(self, wording, row=None, article=None, observed=None):
        return match_report({**self.article, "description": wording, **(article or {})},
                            {**self.row, **(row or {})}, ["Jets", "Winnipeg"],
                            observed or self.observed)
    def test_explicit_forms(self):
        for wording in (
            "Allen will guard the home net in Friday's clash against the Jets, per A Reporter of NHL.com.",
            "Allen will patrol the home crease against Winnipeg on Friday, A Reporter of NHL.com reports.",
            "Allen will patrol the home net in Friday's clash against the Jets, per A Reporter.",
            "Allen will defend the home net against Winnipeg on Friday.",
        ):
            with self.subTest(wording=wording):
                self.assertEqual(self.check(wording)["sourcePublishedAt"], "2026-11-27T15:00:00Z")
    def test_reject_ambiguous_and_wrong_match(self):
        for wording in (
            "Allen is expected to start at home against Winnipeg on Friday.",
            "Allen is set to start at home against Winnipeg on Friday.",
            "Allen will patrol the road net against Winnipeg on Friday.",
            "Allen will patrol the home net against Calgary on Friday.",
            "Allen will patrol the home net against Winnipeg on Saturday.",
            "Allen patrolled the home net against Winnipeg on Friday.",
        ):
            with self.subTest(wording=wording):
                self.assertIsNone(self.check(wording))
    def test_provenance_and_status(self):
        wording = "Allen will patrol the home net against Winnipeg on Friday."
        for article in (
            {"datePublished": None},
            {"datePublished": "2026-11-27T17:00:00Z"},
            {"dateModified": "2026-11-27T15:01:00Z"},
            {"dateModified": "invalid"},
            {"about": {"name": "Other Allen"}},
        ):
            with self.subTest(article=article):
                self.assertIsNone(self.check(wording, article=article))
        self.assertIsNone(self.check(wording, row={"status": "projected"}))
        self.assertIsNone(self.check(wording, observed=datetime.fromisoformat("2026-11-27T20:00:00Z")))

if __name__ == "__main__":
    unittest.main()
