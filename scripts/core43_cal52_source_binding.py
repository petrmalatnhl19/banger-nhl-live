"""CAL-52: bind signed source digests to exact local export bytes.

No network access, Supabase credentials, or database writes. Requires CAL-51
signature verification and independently supplied local source bytes.
"""
from __future__ import annotations
import hashlib
import json
from core43_cal51_signed_bundle import verify_bundle, BundleRejected
from core43_cal49_provenance_gate import REQUIRED_TABLES


class SourceRejected(ValueError):
    pass


def verify_sources(*, manifest, signature_b64, trusted_public_key_pem,
                   pinned_public_key_sha256, expected_manifest_sha256,
                   source_bytes):
    try:
        bundle = verify_bundle(
            manifest=manifest, signature_b64=signature_b64,
            trusted_public_key_pem=trusted_public_key_pem,
            pinned_public_key_sha256=pinned_public_key_sha256,
            expected_manifest_sha256=expected_manifest_sha256)
    except BundleRejected as exc:
        raise SourceRejected("invalid_signed_manifest") from exc
    if not isinstance(source_bytes, dict) or set(source_bytes) != REQUIRED_TABLES:
        raise SourceRejected("missing_or_extra_source_bytes")
    for name in sorted(REQUIRED_TABLES):
        raw = source_bytes[name]
        if not isinstance(raw, bytes) or not raw:
            raise SourceRejected("invalid_source_bytes")
        if hashlib.sha256(raw).hexdigest() != manifest["sources"][name]["sha256"]:
            raise SourceRejected("source_digest_mismatch")
        try:
            rows = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as exc:
            raise SourceRejected("invalid_json_source") from exc
        if not isinstance(rows, list) or len(rows) != manifest["sources"][name]["rows"]:
            raise SourceRejected("source_row_count_mismatch")
        if any(not isinstance(row, dict) for row in rows):
            raise SourceRejected("invalid_source_row")
    return {**bundle, "source_content_hashes_verified": True,
            "reader_permissions_verified": False, "authorized_export": False}
