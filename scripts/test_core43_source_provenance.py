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

    def test_blockers_are_exclusive_and_do_not_promote_starters(self):
        data={"games":[
            {"status":"projected"},
            {"status":"confirmed","gameId":12},
            {"status":"confirmed","goalieId":"123","gameId":12},
            {"status":"confirmed","goalieId":"123","gameId":12,
             "sourcePublishedAt":"not-a-time"},
            {"status":"confirmed","goalieId":"123","gameId":12,
             "sourcePublishedAt":"2026-01-01T00:00:00Z"},
            {"status":"confirmed","goalieId":"123","gameId":None,
             "confirmationBasis":"explicit_pregame_report",
             "sourcePublishedAt":"2026-01-01T00:00:00Z"}]}
        result=audit(data)
        self.assertEqual(result["eligible_evidence_candidates"],0)
        self.assertEqual(result["blocked_by_reason"],{
            "not_confirmed":1,"missing_goalie_id":1,
            "missing_source_publication_time":1,
            "invalid_or_future_publication_time":1,
            "missing_explicit_confirmation_basis":1,"missing_game_id":1})
        self.assertEqual(sum(result["blocked_by_reason"].values()),result["total"])

    def test_valid_individual_confirmation_metadata_is_candidate(self):
        data={"games":[{"status":"confirmed","goalieId":"8479979",
              "gameId":2026020283,"sourcePublishedAt":"2026-11-09T12:00:00Z",
              "confirmationBasis":"explicit_pregame_report"}]}
        self.assertEqual(audit(data)["eligible_evidence_candidates"],1)

if __name__=="__main__":
    unittest.main()
