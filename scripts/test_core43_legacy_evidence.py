import unittest
from scripts.audit_core43_legacy_evidence import suspect_rows

class LegacyEvidenceAuditTests(unittest.TestCase):
    def test_matching_snapshot_is_flagged(self):
        evidence = [{"game_id": 123, "team_code": "DAL", "source_published_at": "2026-11-09T16:00:00+00:00"}]
        observations = [{"game_id": 123, "team_code": "DAL", "source_snapshot_at": "2026-11-09T16:00:00+00:00"}]
        self.assertEqual(len(suspect_rows(evidence, observations)), 1)

    def test_distinct_publication_time_not_flagged(self):
        evidence = [{"game_id": 123, "team_code": "DAL", "source_published_at": "2026-11-09T15:00:00+00:00"}]
        observations = [{"game_id": 123, "team_code": "DAL", "source_snapshot_at": "2026-11-09T16:00:00+00:00"}]
        self.assertEqual(suspect_rows(evidence, observations), [])

if __name__ == "__main__":
    unittest.main()
