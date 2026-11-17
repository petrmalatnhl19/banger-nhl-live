"""Offline CAL-47 validation tests. Run: python -m unittest discover -s tests -p 'test_core43_cal47.py'"""
import unittest
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core43_cal47_offline_revision import Side, RevisionRejected, propose_revision


START = datetime(2026, 11, 18, 0, 0, tzinfo=timezone.utc)
def stamp(minutes_before):
    return (START - timedelta(minutes=minutes_before)).isoformat()

def side(team, goalie):
    return Side(team, goalie, "confirmed", stamp(100), stamp(95),
                "2.60", 267, stamp(150), "a" * 64)

def params():
    return dict(game_id=2026020335, away_team="EDM", home_team="FLA",
                kickoff_at=stamp(0), source_prediction_at=stamp(705),
                as_of=stamp(60), away=side("EDM", "8482221"),
                home=side("FLA", "8474593"),
                model_version="core43-shadow-gsax-v1-heuristic-unvalidated")

class OfflineRevisionTests(unittest.TestCase):
    def test_valid_later_revision_and_determinism(self):
        p = params()
        original = dict(p)
        a = propose_revision(**p)
        self.assertEqual(a, propose_revision(**p))
        self.assertEqual(p, original)
        self.assertEqual(a["revision_kind"], "later_pregame_experimental")
        self.assertEqual(a["source_prediction_at"], stamp(705))
        self.assertEqual(a["authorization"], "offline_proposal_only")

    def reject(self, **changes):
        p = params()
        p.update(changes)
        with self.assertRaises(RevisionRejected):
            propose_revision(**p)

    def test_no_backdating(self):
        self.reject(as_of=stamp(706))
    def test_after_kickoff(self):
        self.reject(as_of=stamp(-1))
    def test_outside_window(self):
        self.reject(as_of=stamp(90))
    def test_unconfirmed(self):
        self.reject(away=replace(side("EDM","8482221"), evidence_status="projected"))
    def test_evidence_after_capture(self):
        self.reject(away=replace(side("EDM","8482221"), verified_at=stamp(40)))
    def test_published_after_verified(self):
        self.reject(away=replace(side("EDM","8482221"), published_at=stamp(90)))
    def test_wrong_team(self):
        self.reject(away=side("FLA","8482221"))
    def test_duplicate_goalie(self):
        self.reject(home=side("FLA","8482221"))
    def test_gsax_after_asof(self):
        self.reject(home=replace(side("FLA","8474593"), gsax_fetched_at=stamp(30)))
    def test_small_sample(self):
        self.reject(home=replace(side("FLA","8474593"), shots_against=29))
    def test_invalid_digest(self):
        self.reject(home=replace(side("FLA","8474593"), snapshot_sha256="not-a-hash"))
    def test_nonfinite_gsax(self):
        self.reject(home=replace(side("FLA","8474593"), gsax="NaN"))
    def test_missing_timezone(self):
        self.reject(as_of="2026-11-17T23:00:00")
    def test_wrong_model(self):
        self.reject(model_version="banger-core-v4.2")

if __name__ == "__main__":
    unittest.main()
