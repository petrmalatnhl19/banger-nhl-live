#!/usr/bin/env python3
"""SECURITY-45: offline Ed25519 signed snapshot integrity tests; ephemeral test key only."""
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


def canonical(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def run(*args):
    return subprocess.run(["openssl", *map(str, args)], capture_output=True, check=True)


class SignedSnapshotTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)
        self.key = self.path / "private.pem"
        self.pub = self.path / "public.pem"
        run("genpkey", "-algorithm", "Ed25519", "-out", self.key)
        run("pkey", "-in", self.key, "-pubout", "-out", self.pub)
        self.snapshot = {
            "game_id": 45,
            "model_version": "CORE-4.3-test",
            "cutoff_at": "2026-11-16T19:00:00Z",
            "generated_at": "2026-11-16T19:01:00Z",
            "source_ids": ["RotoWire:synthetic-45"],
            "input_sha256": hashlib.sha256(b"synthetic inputs").hexdigest(),
            "prediction": {"home_win_probability": 0.57},
            "previous_snapshot_sha256": None,
        }

    def sign(self, obj):
        msg = self.path / "snapshot.bin"
        sig = self.path / "snapshot.sig"
        msg.write_bytes(canonical(obj))
        run("pkeyutl", "-sign", "-inkey", self.key, "-rawin", "-in", msg, "-out", sig)
        return sig.read_bytes()

    def verify(self, obj, signature):
        msg = self.path / "verify.bin"
        sig = self.path / "verify.sig"
        msg.write_bytes(canonical(obj))
        sig.write_bytes(signature)
        result = subprocess.run(
            ["openssl", "pkeyutl", "-verify", "-pubin", "-inkey", str(self.pub),
             "-rawin", "-in", str(msg), "-sigfile", str(sig)],
            capture_output=True,
        )
        return result.returncode == 0

    def test_signed_snapshot_valid(self):
        self.assertTrue(self.verify(self.snapshot, self.sign(self.snapshot)))

    def test_canonical_order_independent(self):
        sig = self.sign(self.snapshot)
        self.assertTrue(self.verify(dict(reversed(list(self.snapshot.items()))), sig))

    def test_changed_prediction_rejected(self):
        sig = self.sign(self.snapshot)
        modified = json.loads(json.dumps(self.snapshot))
        modified["prediction"]["home_win_probability"] = 0.73
        self.assertFalse(self.verify(modified, sig))

    def test_changed_cutoff_rejected(self):
        sig = self.sign(self.snapshot)
        modified = dict(self.snapshot, cutoff_at="2026-11-16T20:00:00Z")
        self.assertFalse(self.verify(modified, sig))

    def test_changed_source_rejected(self):
        sig = self.sign(self.snapshot)
        modified = dict(self.snapshot, source_ids=["RotoWire:other"])
        self.assertFalse(self.verify(modified, sig))

    def test_changed_input_hash_rejected(self):
        sig = self.sign(self.snapshot)
        modified = dict(self.snapshot, input_sha256="0" * 64)
        self.assertFalse(self.verify(modified, sig))

    def test_changed_model_rejected(self):
        sig = self.sign(self.snapshot)
        modified = dict(self.snapshot, model_version="CORE-4.2")
        self.assertFalse(self.verify(modified, sig))

    def test_chain_rejects_modified_predecessor(self):
        first = self.snapshot
        first_sig = self.sign(first)
        first_hash = hashlib.sha256(canonical(first)).hexdigest()
        second = dict(first, cutoff_at="2026-11-16T19:15:00Z",
                      previous_snapshot_sha256=first_hash)
        second_sig = self.sign(second)
        self.assertTrue(self.verify(first, first_sig))
        self.assertTrue(self.verify(second, second_sig))
        tampered_first = dict(first, generated_at="2026-11-16T19:02:00Z")
        self.assertNotEqual(hashlib.sha256(canonical(tampered_first)).hexdigest(),
                            second["previous_snapshot_sha256"])
        self.assertFalse(self.verify(tampered_first, first_sig))

    def test_other_key_cannot_sign(self):
        sig = self.sign(self.snapshot)
        other = self.path / "other.pem"
        run("genpkey", "-algorithm", "Ed25519", "-out", other)
        run("pkey", "-in", other, "-pubout", "-out", self.pub)
        self.assertFalse(self.verify(self.snapshot, sig))


if __name__ == "__main__":
    unittest.main(verbosity=2)
