import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core43_cal49_provenance_gate import verify_provenance, ExportRejected, REQUIRED_TABLES


def fixture():
    kickoff = datetime(2026, 11, 18, tzinfo=timezone.utc)
    def t(m): return (kickoff - timedelta(minutes=m)).isoformat()
    revision = {"authorization":"offline_proposal_only",
        "revision_kind":"later_pregame_experimental",
        "source_prediction_at":t(705),"as_of":t(60),"kickoff_at":t(0),
        "proposal_sha256":"a"*64}
    sources = {k:{"rows":1,"sha256":"b"*64,"captured_at":t(61)} for k in REQUIRED_TABLES}
    reader = {"role":"cal06_reader","authorized_tables":sorted(REQUIRED_TABLES),
              "verified_by":"independent_access_test"}
    signature = {"algorithm":"Ed25519",
        "verification":"verified_by_independent_trust_anchor",
        "trusted_key_fingerprint":"c"*64,"payload_sha256":"a"*64}
    return dict(revision=revision,sources=sources,reader=reader,signature=signature)


class ProvenanceGateTests(unittest.TestCase):
    def test_metadata_consistency_does_not_authorize_export(self):
        p=fixture()
        self.assertEqual(verify_provenance(**p),{"status":"metadata_consistent_only","authorized_export":False})
    def reject(self, mutate):
        p=fixture()
        mutate(p)
        with self.assertRaises(ExportRejected):
            verify_provenance(**p)
    def test_missing_source(self):
        self.reject(lambda p:p["sources"].pop("nhl_prediction_archive"))
    def test_extra_source(self):
        self.reject(lambda p:p["sources"].update({"extra":{}}))
    def test_empty_source(self):
        self.reject(lambda p:p["sources"]["nhl_prediction_archive"].update(rows=0))
    def test_future_source(self):
        self.reject(lambda p:p["sources"]["nhl_prediction_archive"].update(captured_at=p["revision"]["kickoff_at"]))
    def test_invalid_digest(self):
        self.reject(lambda p:p["sources"]["nhl_prediction_archive"].update(sha256="bad"))
    def test_service_role_rejected(self):
        self.reject(lambda p:p["reader"].update(role="service_role"))
    def test_unverified_reader(self):
        self.reject(lambda p:p["reader"].update(verified_by="self_reported"))
    def test_missing_reader_table(self):
        self.reject(lambda p:p["reader"].update(authorized_tables=[]))
    def test_unverified_signature(self):
        self.reject(lambda p:p["signature"].update(verification="self_reported"))
    def test_wrong_algorithm(self):
        self.reject(lambda p:p["signature"].update(algorithm="none"))
    def test_wrong_payload(self):
        self.reject(lambda p:p["signature"].update(payload_sha256="d"*64))
    def test_missing_trust_anchor(self):
        self.reject(lambda p:p["signature"].update(trusted_key_fingerprint=""))
    def test_time_travel(self):
        self.reject(lambda p:p["revision"].update(as_of=p["revision"]["source_prediction_at"]))
    def test_outside_window(self):
        self.reject(lambda p:p["revision"].update(as_of=p["revision"]["kickoff_at"]))
    def test_retroactive_revision_kind(self):
        self.reject(lambda p:p["revision"].update(revision_kind="original_core42"))

if __name__=="__main__":
    unittest.main()
