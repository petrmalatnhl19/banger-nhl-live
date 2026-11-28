import base64
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime,timedelta,timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from core43_cal49_provenance_gate import REQUIRED_TABLES
from core43_cal51_signed_bundle import canonical_manifest
from core43_cal55_verified_reservation import verify_and_reserve,PipelineRejected
from core43_cal54_sqlite_ledger import seen_digests


def cmd(*args):
    return subprocess.run(["openssl",*args],capture_output=True,check=True,timeout=5).stdout


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.root=Path(self.tmp.name)
        self.private=self.root/"private.pem"
        self.public=self.root/"public.pem"
        cmd("genpkey","-algorithm","Ed25519","-out",str(self.private))
        cmd("pkey","-in",str(self.private),"-pubout","-out",str(self.public))
        self.pub=self.public.read_bytes()
        self.pin=hashlib.sha256(cmd("pkey","-pubin","-in",str(self.public),"-outform","DER")).hexdigest()
        self.db=str(self.root/"ledger.db")
    def tearDown(self):
        self.tmp.cleanup()
    def fixture(self):
        kickoff=datetime(2026,11,18,tzinfo=timezone.utc)
        def t(n):return (kickoff-timedelta(minutes=n)).isoformat()
        raw={name:json.dumps([{"source":name}],separators=(",",":")).encode()
             for name in REQUIRED_TABLES}
        manifest={"revision":{"authorization":"offline_proposal_only",
            "revision_kind":"later_pregame_experimental",
            "game_id":2026020335,"away_team":"EDM","home_team":"FLA",
            "source_prediction_at":t(705),"as_of":t(60),
            "kickoff_at":t(0),"proposal_sha256":"a"*64},
            "sources":{name:{"rows":1,"sha256":hashlib.sha256(raw[name]).hexdigest(),
                "captured_at":t(61)} for name in REQUIRED_TABLES},
            "reader":{"role":"cal06_reader","authorized_tables":sorted(REQUIRED_TABLES),
                "verified_by":"independent_access_test"}}
        payload=canonical_manifest(manifest)
        msg=self.root/"msg.bin"
        msg.write_bytes(payload)
        signature=base64.b64encode(cmd("pkeyutl","-sign","-inkey",str(self.private),
            "-rawin","-in",str(msg))).decode()
        return dict(db_path=self.db,expected_game_id=2026020335,
            expected_teams=("EDM","FLA"),expected_kickoff=t(0),
            manifest=manifest,signature_b64=signature,
            trusted_public_key_pem=self.pub,pinned_public_key_sha256=self.pin,
            expected_manifest_sha256=hashlib.sha256(payload).hexdigest(),
            source_bytes=raw)
    def reject(self,change):
        p=self.fixture()
        change(p)
        with self.assertRaises(PipelineRejected):
            verify_and_reserve(**p)
        self.assertFalse(Path(self.db).exists())
    def test_valid_reservation(self):
        out=verify_and_reserve(**self.fixture())
        self.assertEqual(out["status"],"reserved_offline")
        self.assertFalse(out["authorized_export"])
    def test_duplicate_rejected(self):
        p=self.fixture()
        verify_and_reserve(**p)
        with self.assertRaises(PipelineRejected):
            verify_and_reserve(**p)
    def test_persists_digest(self):
        p=self.fixture()
        verify_and_reserve(**p)
        self.assertIn(p["expected_manifest_sha256"],seen_digests(self.db))
    def test_tampered_payload(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive=b"[]"))
    def test_bad_signature(self):
        self.reject(lambda p:p.update(signature_b64=base64.b64encode(bytes(64)).decode()))
    def test_wrong_game(self):
        self.reject(lambda p:p.update(expected_game_id=2026020336))
    def test_swapped_teams(self):
        self.reject(lambda p:p.update(expected_teams=("FLA","EDM")))
    def test_wrong_kickoff(self):
        self.reject(lambda p:p.update(expected_kickoff="2026-11-18T01:00:00Z"))
    def test_bad_key_pin(self):
        self.reject(lambda p:p.update(pinned_public_key_sha256="0"*64))
    def test_bad_manifest_digest(self):
        self.reject(lambda p:p.update(expected_manifest_sha256="0"*64))
    def test_corrupt_ledger_fail_closed(self):
        Path(self.db).write_bytes(b"corrupt database")
        with self.assertRaises(PipelineRejected):
            verify_and_reserve(**self.fixture())
    def test_rejects_signed_metadata_tamper(self):
        self.reject(lambda p:p["manifest"]["reader"].update(role="service_role"))

if __name__=="__main__":
    unittest.main()
