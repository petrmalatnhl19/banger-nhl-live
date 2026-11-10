import datetime as dt
import unittest
from scripts.check_rotowire_publisher_health import inspect

NOW = dt.datetime(2026, 11, 10, 18, 0, tzinfo=dt.timezone.utc)

class PublisherHealthTests(unittest.TestCase):
    def test_fresh(self):
        self.assertEqual(inspect({"updatedAt": "2026-11-10T17:00:00Z", "games": []}, NOW)["status"], "fresh")
    def test_stale(self):
        self.assertEqual(inspect({"updatedAt": "2026-11-09T16:26:07Z"}, NOW)["status"], "stale")
    def test_invalid(self):
        self.assertEqual(inspect({"updatedAt": "bad"}, NOW)["status"], "invalid_timestamp")
    def test_future(self):
        self.assertEqual(inspect({"updatedAt": "2026-11-10T20:00:00Z"}, NOW)["status"], "future_timestamp")

if __name__ == "__main__":
    unittest.main()
