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
from core43_cal53_game_replay import verify_game_bundle,ReplayRejected


def cmd(*args):
    return subprocess.run(["openssl",*args],capture_output=True,check=True,timeout=5).stdout


class GameReplayTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.tmp.name)
        cls.private=cls.root/"key.pem"
        cls.public=cls.root/"pub.pem"
        cmd("genpkey","-algorithm","Ed25519","-out",str(cls.private))
        cmd("pkey","-in",str(cls.private),"-pubout","-out",str(cls.public))
        cls.pub=cls.public.read_bytes()
        cls.pin=hashlib.sha256(cmd("pkey","-pubin","-in",str(cls.public),"-outform","DER")).hexdigest()
    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()
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
        msg=self.root/"message.bin"
        msg.write_bytes(payload)
        sig=base64.b64encode(cmd("pkeyutl","-sign","-inkey",str(self.private),
            "-rawin","-in",str(msg))).decode()
        return dict(expected_game_id=2026020335,expected_teams=("EDM","FLA"),
            expected_kickoff=t(0),seen_manifest_hashes=frozenset(),
            manifest=manifest,signature_b64=sig,trusted_public_key_pem=self.pub,
            pinned_public_key_sha256=self.pin,
            expected_manifest_sha256=hashlib.sha256(payload).hexdigest(),source_bytes=raw)
    def reject(self,modify):
        p=self.fixture()
        modify(p)
        with self.assertRaises(ReplayRejected):
            verify_game_bundle(**p)
    def test_valid_game_binding(self):
        r=verify_game_bundle(**self.fixture())
        self.assertTrue(r["game_binding_verified"])
        self.assertFalse(r["persistent_replay_prevention"])
        self.assertFalse(r["authorized_export"])
    def test_replay_seen(self):
        self.reject(lambda p:p.update(seen_manifest_hashes=frozenset([p["expected_manifest_sha256"]])))
    def test_wrong_game(self):
        self.reject(lambda p:p.update(expected_game_id=2026020336))
    def test_wrong_away_team(self):
        self.reject(lambda p:p.update(expected_teams=("DAL","FLA")))
    def test_swapped_teams(self):
        self.reject(lambda p:p.update(expected_teams=("FLA","EDM")))
    def test_wrong_kickoff(self):
        self.reject(lambda p:p.update(expected_kickoff="2026-11-18T01:00:00Z"))
    def test_missing_ledger(self):
        self.reject(lambda p:p.update(seen_manifest_hashes=None))
    def test_wrong_signed_game(self):
        self.reject(lambda p:p["manifest"]["revision"].update(game_id=2026020336))
    def test_wrong_signed_team(self):
        self.reject(lambda p:p["manifest"]["revision"].update(home_team="DAL"))
    def test_wrong_signed_kickoff(self):
        self.reject(lambda p:p["manifest"]["revision"].update(kickoff_at="2026-11-18T01:00:00Z"))
    def test_tampered_bytes(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive=b"[]"))
    def test_wrong_signature(self):
        self.reject(lambda p:p.update(signature_b64=base64.b64encode(bytes(64)).decode()))
    def test_duplicate_expected_teams(self):
        self.reject(lambda p:p.update(expected_teams=("EDM","EDM")))
    def test_nonpositive_game(self):
        self.reject(lambda p:p.update(expected_game_id=0))

if __name__=="__main__":
    unittest.main()
