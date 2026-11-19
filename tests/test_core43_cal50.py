import base64
import hashlib
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from core43_cal50_signature_verify import verify_package, VerificationError


def cmd(*args):
    p=subprocess.run(["openssl",*args],capture_output=True,check=True,timeout=5)
    return p.stdout


class SignatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory()
        cls.root=Path(cls.tmp.name)
        cls.priv=cls.root/"private.pem"
        cls.pub=cls.root/"public.pem"
        cmd("genpkey","-algorithm","Ed25519","-out",str(cls.priv))
        cmd("pkey","-in",str(cls.priv),"-pubout","-out",str(cls.pub))
        cls.key=cls.pub.read_bytes()
        cls.keyhash=hashlib.sha256(cmd("pkey","-pubin","-in",str(cls.pub),"-outform","DER")).hexdigest()
        cls.payload=b'{"as_of":"2026-11-17T23:00:00Z","game_id":2026020335}'
        cls.sig=cls.sign(cls.payload)
    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()
    @classmethod
    def sign(cls, payload):
        msg=cls.root/"message.bin"
        msg.write_bytes(payload)
        return base64.b64encode(cmd("pkeyutl","-sign","-inkey",str(cls.priv),"-rawin","-in",str(msg))).decode()
    def params(self):
        return dict(payload=self.payload,signature_b64=self.sig,
            trusted_public_key_pem=self.key,expected_key_sha256=self.keyhash,
            expected_payload_sha256=hashlib.sha256(self.payload).hexdigest())
    def reject(self,**changes):
        p=self.params()
        p.update(changes)
        with self.assertRaises(VerificationError):
            verify_package(**p)
    def test_valid_signature(self):
        self.assertTrue(verify_package(**self.params())["verified"])
    def test_no_export_authorization(self):
        self.assertFalse(verify_package(**self.params())["authorization_to_export"])
    def test_tampered_payload(self):
        self.reject(payload=self.payload+b"!")
    def test_wrong_digest(self):
        self.reject(expected_payload_sha256="0"*64)
    def test_bad_key_pin(self):
        self.reject(expected_key_sha256="0"*64)
    def test_invalid_pin(self):
        self.reject(expected_key_sha256="invalid")
    def test_bad_signature(self):
        self.reject(signature_b64=base64.b64encode(bytes(64)).decode())
    def test_short_signature(self):
        self.reject(signature_b64=base64.b64encode(bytes(63)).decode())
    def test_malformed_base64(self):
        self.reject(signature_b64="not base64!!")
    def test_missing_anchor(self):
        self.reject(trusted_public_key_pem=b"")
    def test_wrong_public_key(self):
        self.reject(trusted_public_key_pem=b"bad pem")
    def test_empty_payload(self):
        self.reject(payload=b"")
    def test_other_message_signature(self):
        self.reject(signature_b64=self.sign(b"other message"))
    def test_noncanonical_bytes_are_not_equivalent(self):
        self.reject(payload=self.payload+b" ")
    def test_signature_not_bytes(self):
        self.reject(signature_b64=b"bad")

if __name__=="__main__":
    unittest.main()
