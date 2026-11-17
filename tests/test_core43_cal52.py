import base64
import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from core43_cal49_provenance_gate import REQUIRED_TABLES
from core43_cal51_signed_bundle import canonical_manifest
from core43_cal52_source_binding import verify_sources, SourceRejected


def cmd(*args):
    return subprocess.run(["openssl",*args],capture_output=True,check=True,timeout=5).stdout


class SourceBindingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.tmp.name)
        cls.private=cls.root/"private.pem"
        cls.public=cls.root/"public.pem"
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
            "source_prediction_at":t(705),"as_of":t(60),
            "kickoff_at":t(0),"proposal_sha256":"a"*64},
            "sources":{name:{"rows":1,"sha256":hashlib.sha256(raw[name]).hexdigest(),
                "captured_at":t(61)} for name in REQUIRED_TABLES},
            "reader":{"role":"cal06_reader","authorized_tables":sorted(REQUIRED_TABLES),
                "verified_by":"independent_access_test"}}
        payload=canonical_manifest(manifest)
        msg=self.root/"message.bin"
        msg.write_bytes(payload)
        signature=base64.b64encode(cmd("pkeyutl","-sign","-inkey",str(self.private),
            "-rawin","-in",str(msg))).decode()
        return dict(manifest=manifest,signature_b64=signature,
            trusted_public_key_pem=self.pub,pinned_public_key_sha256=self.pin,
            expected_manifest_sha256=hashlib.sha256(payload).hexdigest(),source_bytes=raw)
    def reject(self,change):
        p=self.fixture()
        change(p)
        with self.assertRaises(SourceRejected):
            verify_sources(**p)
    def test_valid_local_bytes(self):
        r=verify_sources(**self.fixture())
        self.assertTrue(r["source_content_hashes_verified"])
        self.assertFalse(r["reader_permissions_verified"])
        self.assertFalse(r["authorized_export"])
    def test_missing_source(self):
        self.reject(lambda p:p["source_bytes"].pop("nhl_prediction_archive"))
    def test_extra_source(self):
        self.reject(lambda p:p["source_bytes"].update(extra=b"[]"))
    def test_modified_bytes(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive=b'[{"source":"changed"}]'))
    def test_empty_bytes(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive=b""))
    def test_non_bytes(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive="[]"))
    def test_wrong_manifest_pin(self):
        self.reject(lambda p:p.update(expected_manifest_sha256="0"*64))
    def test_wrong_public_key_pin(self):
        self.reject(lambda p:p.update(pinned_public_key_sha256="0"*64))
    def test_signature_corrupt(self):
        self.reject(lambda p:p.update(signature_b64=base64.b64encode(bytes(64)).decode()))
    def test_reordered_json_bytes_rejected(self):
        self.reject(lambda p:p["source_bytes"].update(nhl_prediction_archive=b'[ { "source": "nhl_prediction_archive" } ]'))
    def test_no_trust_anchor(self):
        self.reject(lambda p:p.update(trusted_public_key_pem=b""))
    def test_manifest_source_modified_without_resign(self):
        self.reject(lambda p:p["manifest"]["sources"]["nhl_prediction_archive"].update(rows=2))

if __name__=="__main__":
    unittest.main()
