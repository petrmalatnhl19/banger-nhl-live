"""CAL-51: verify a signed canonical export manifest, offline and fail-closed.

The signature covers revision, source metadata, and reader identity together.
An external trusted public-key pin is mandatory. No Supabase access or writes.
"""
from __future__ import annotations
import hashlib
import json

from core43_cal49_provenance_gate import verify_provenance, ExportRejected
from core43_cal50_signature_verify import verify_package, VerificationError


class BundleRejected(ValueError):
    pass


def canonical_manifest(manifest: dict) -> bytes:
    if not isinstance(manifest, dict) or set(manifest) != {"revision", "sources", "reader"}:
        raise BundleRejected("unexpected_manifest_shape")
    try:
        return json.dumps(manifest, sort_keys=True, separators=(",", ":"),
                          ensure_ascii=False, allow_nan=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise BundleRejected("invalid_manifest") from exc


def verify_bundle(*, manifest: dict, signature_b64: str,
                  trusted_public_key_pem: bytes, pinned_public_key_sha256: str,
                  expected_manifest_sha256: str) -> dict:
    payload = canonical_manifest(manifest)
    digest = hashlib.sha256(payload).hexdigest()
    if digest != expected_manifest_sha256:
        raise BundleRejected("manifest_digest_mismatch")
    try:
        crypto = verify_package(
            payload=payload, signature_b64=signature_b64,
            trusted_public_key_pem=trusted_public_key_pem,
            expected_key_sha256=pinned_public_key_sha256,
            expected_payload_sha256=expected_manifest_sha256)
    except VerificationError as exc:
        raise BundleRejected("signature_or_trust_failure") from exc
    revision = manifest["revision"]
    if not isinstance(revision, dict):
        raise BundleRejected("invalid_revision")
    # CAL-49's metadata check must refer to the same signed bytes. The
    # independent trust anchor is established by CAL-50, not by package claims.
    evidence = {"algorithm": "Ed25519",
        "verification": "verified_by_independent_trust_anchor",
        "trusted_key_fingerprint": crypto["trusted_key_sha256"],
        "payload_sha256": revision.get("proposal_sha256")}
    try:
        metadata = verify_provenance(revision=revision, sources=manifest["sources"],
                                     reader=manifest["reader"], signature=evidence)
    except (ExportRejected, KeyError, TypeError) as exc:
        raise BundleRejected("provenance_failure") from exc
    return {"verified": True, "manifest_sha256": digest,
            "metadata_status": metadata["status"],
            "authorized_export": False,
            "source_content_hashes_verified": False,
            "reader_permissions_verified": False}
