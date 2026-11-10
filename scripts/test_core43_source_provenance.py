"""Regression tests: source fetch time must never become a confirmation publication time."""
import unittest
from scripts.audit_core43_rotowire_evidence import audit

class EvidenceProvenanceTests(unittest.TestCase):
    def test_confirmed_without_publication_time_is_not_eligible(self):
        data={"updatedAt":"2026-11-09T16:26:07Z","games":[{"status":"confirmed",
              "goalieId":"8479979","gameId":2026020283,
              "confirmationBasis":"explicit_pregame_report"}]}
        result=audit(data)
        self.assertEqual(result["confirmed"],1)
        self.assertEqual(result["eligible_evidence_candidates"],0)

    def test_projected_with_metadata_is_not_eligible(self):
        data={"games":[{"status":"projected","goalieId":"8479979",
              "gameId":2026020283,"sourcePublishedAt":"2026-11-09T12:00:00Z",
              "confirmationBasis":"explicit_pregame_report"}]}
        self.assertEqual(audit(data)["eligible_evidence_candidates"],0)

    def test_valid_individual_confirmation_metadata_is_candidate(self):
        data={"games":[{"status":"confirmed","goalieId":"8479979",
              "gameId":2026020283,"sourcePublishedAt":"2026-11-09T12:00:00Z",
              "confirmationBasis":"explicit_pregame_report"}]}
        self.assertEqual(audit(data)["eligible_evidence_candidates"],1)

if __name__=="__main__":
    unittest.main()
