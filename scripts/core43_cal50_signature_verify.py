"""CAL-50 independent Ed25519 package verifier. Offline, no Supabase access.

Trust anchors MUST be supplied out-of-band. This module never generates trust keys
or treats package-provided metadata as an authorization to export.
"""
from __future__ import annotations
import base64
import hashlib
import json
import re
import subprocess
import tempfile
from pathlib import Path


class VerificationError(ValueError):
    pass


def _openssl(*args):
    try:
        p = subprocess.run(["openssl", *args], capture_output=True, timeout=5, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise VerificationError("openssl_unavailable_or_timed_out") from exc
    if p.returncode:
        raise VerificationError("cryptographic_verification_failed")
    return p.stdout


def verify_package(*, payload: bytes, signature_b64: str,
                   trusted_public_key_pem: bytes, expected_key_sha256: str,
                   expected_payload_sha256: str) -> dict:
    """Verify exact payload bytes and Ed25519 signature against a pinned public key.

    expected_key_sha256 is SHA256 of SubjectPublicKeyInfo DER; both expected
    digests are supplied by the caller, not read from the signed package.
    """
    if not isinstance(payload, bytes) or not payload:
        raise VerificationError("empty_payload")
    if not isinstance(trusted_public_key_pem, bytes) or not trusted_public_key_pem:
        raise VerificationError("missing_trust_anchor")
    for value in (expected_key_sha256, expected_payload_sha256):
        if not isinstance(value, str) or re.fullmatch(r"[0-9a-f]{64}", value) is None:
            raise VerificationError("invalid_pin")
    if hashlib.sha256(payload).hexdigest() != expected_payload_sha256:
        raise VerificationError("payload_digest_mismatch")
    if not isinstance(signature_b64, str):
        raise VerificationError("invalid_signature")
    try:
        signature = base64.b64decode(signature_b64, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise VerificationError("invalid_signature_encoding") from exc
    if len(signature) != 64:
        raise VerificationError("invalid_signature_length")
    with tempfile.TemporaryDirectory(prefix="core43-cal50-") as tmp:
        root = Path(tmp)
        key = root / "trusted.pem"
        msg = root / "payload.bin"
        sig = root / "signature.bin"
        key.write_bytes(trusted_public_key_pem)
        msg.write_bytes(payload)
        sig.write_bytes(signature)
        der = _openssl("pkey", "-pubin", "-in", str(key), "-outform", "DER")
        if hashlib.sha256(der).hexdigest() != expected_key_sha256:
            raise VerificationError("trust_anchor_mismatch")
        # -rawin is required for Ed25519; never use digest-based verification.
        _openssl("pkeyutl", "-verify", "-pubin", "-inkey", str(key),
                 "-rawin", "-in", str(msg), "-sigfile", str(sig))
    return {"verified": True, "algorithm": "Ed25519",
            "payload_sha256": expected_payload_sha256,
            "trusted_key_sha256": expected_key_sha256,
            "authorization_to_export": False}
