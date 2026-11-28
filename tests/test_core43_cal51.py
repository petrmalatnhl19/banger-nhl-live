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
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core43_cal51_signed_bundle import canonical_manifest, verify_bundle, BundleRejected
from core43_cal49_provenance_gate import REQUIRED_TABLES


def cmd(*args):
    return subprocess.run(["openssl",*args],capture_output=True,check=True,timeout=5).stdout


class BundleTests(unittest.TestCase):
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
    def manifest(self):
        kickoff=datetime(2026,11,18,tzinfo=timezone.utc)
        def t(n):return (kickoff-timedelta(minutes=n)).isoformat()
        return {"revision":{"authorization":"offline_proposal_only",
            "revision_kind":"later_pregame_experimental",
            "source_prediction_at":t(705),"as_of":t(60),
            "kickoff_at":t(0),"proposal_sha256":"a"*64},
            "sources":{name:{"rows":1,"sha256":"b"*64,"captured_at":t(61)}
                       for name in REQUIRED_TABLES},
            "reader":{"role":"cal06_reader","authorized_tables":sorted(REQUIRED_TABLES),
                      "verified_by":"independent_access_test"}}
    def signed(self, manifest):
        payload=canonical_manifest(manifest)
        msg=self.root/"msg.bin"
        msg.write_bytes(payload)
        sig=base64.b64encode(cmd("pkeyutl","-sign","-inkey",str(self.private),
                                 "-rawin","-in",str(msg))).decode()
        return dict(manifest=manifest,signature_b64=sig,
                    trusted_public_key_pem=self.pub,pinned_public_key_sha256=self.pin,
                    expected_manifest_sha256=hashlib.sha256(payload).hexdigest())
    def reject(self, mutation, resign=False):
        p=self.signed(self.manifest())
        mutation(p)
        if resign:
            p=self.signed(p["manifest"])
        with self.assertRaises(BundleRejected):
            verify_bundle(**p)
    def test_valid_signed_manifest_still_not_export_authorized(self):
        out=verify_bundle(**self.signed(self.manifest()))
        self.assertTrue(out["verified"])
        self.assertFalse(out["authorized_export"])
        self.assertFalse(out["source_content_hashes_verified"])
        self.assertFalse(out["reader_permissions_verified"])
    def test_tamper_source_digest(self):
        self.reject(lambda p:p["manifest"]["sources"]["nhl_prediction_archive"].update(sha256="c"*64))
    def test_tamper_reader(self):
        self.reject(lambda p:p["manifest"]["reader"].update(role="service_role"))
    def test_tamper_revision(self):
        self.reject(lambda p:p["manifest"]["revision"].update(as_of="2026-11-17T12:00:00Z"))
    def test_wrong_signature(self):
        self.reject(lambda p:p.update(signature_b64=base64.b64encode(bytes(64)).decode()))
    def test_wrong_trust_pin(self):
        self.reject(lambda p:p.update(pinned_public_key_sha256="0"*64))
    def test_wrong_digest(self):
        self.reject(lambda p:p.update(expected_manifest_sha256="0"*64))
    def test_signed_service_role_still_rejected(self):
        self.reject(lambda p:p["manifest"]["reader"].update(role="service_role"),resign=True)
    def test_signed_missing_source_still_rejected(self):
        self.reject(lambda p:p["manifest"]["sources"].pop("nhl_prediction_archive"),resign=True)
    def test_signed_future_source_still_rejected(self):
        self.reject(lambda p:p["manifest"]["sources"]["nhl_prediction_archive"].update(captured_at="2026-11-18T00:00:00Z"),resign=True)
    def test_signed_self_reported_reader_rejected(self):
        self.reject(lambda p:p["manifest"]["reader"].update(verified_by="self_reported"),resign=True)
    def test_signed_wrong_window_rejected(self):
        self.reject(lambda p:p["manifest"]["revision"].update(as_of="2026-11-17T21:00:00Z"),resign=True)
    def test_extra_manifest_field(self):
        self.reject(lambda p:p["manifest"].update(extra=1))
    def test_canonical_order_independent(self):
        m=self.manifest()
        p=self.signed(m)
        p["manifest"]={"reader":m["reader"],"sources":m["sources"],"revision":m["revision"]}
        self.assertTrue(verify_bundle(**p)["verified"])

if __name__=="__main__":
    unittest.main()
