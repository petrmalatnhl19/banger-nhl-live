"""CAL-49: offline export provenance gate. No DB access, writes or signature generation."""
from __future__ import annotations
from datetime import datetime, timezone
from hashlib import sha256
import json
import re


class ExportRejected(ValueError):
    pass


REQUIRED_TABLES = frozenset({
    "nhl_prediction_archive", "nhl_core43_schedule_snapshots",
    "nhl_core43_rotowire_observations", "nhl_core43_goalie_identity_map",
    "nhl_core43_goalie_snapshots",
})


def instant(value):
    if not isinstance(value, str):
        raise ExportRejected("timestamp_required")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExportRejected("invalid_timestamp") from exc
    if parsed.tzinfo is None:
        raise ExportRejected("timezone_required")
    return parsed.astimezone(timezone.utc)


def verify_provenance(*, revision, sources, reader, signature):
    """Fail closed unless provenance AND independently verified signature are proven.

    signature is an attestation produced by an external trusted verifier, not
    inferred from a digest or an untrusted self-asserted flag.
    """
    if not isinstance(revision, dict) or revision.get("authorization") != "offline_proposal_only":
        raise ExportRejected("unexpected_revision")
    if revision.get("revision_kind") != "later_pregame_experimental":
        raise ExportRejected("wrong_revision_kind")
    original = instant(revision["source_prediction_at"])
    asof = instant(revision["as_of"])
    kickoff = instant(revision["kickoff_at"])
    if not original < asof < kickoff:
        raise ExportRejected("time_order")
    if not 45 * 60 <= (kickoff - asof).total_seconds() <= 75 * 60:
        raise ExportRejected("outside_window")
    if not isinstance(sources, dict) or set(sources) != REQUIRED_TABLES:
        raise ExportRejected("missing_or_extra_sources")
    for name, meta in sources.items():
        if not isinstance(meta, dict):
            raise ExportRejected("invalid_source")
        if not isinstance(meta.get("rows"), int) or isinstance(meta["rows"], bool) or meta["rows"] < 1:
            raise ExportRejected("empty_source")
        digest = meta.get("sha256")
        if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
            raise ExportRejected("invalid_source_digest")
        if instant(meta.get("captured_at")) > asof:
            raise ExportRejected("future_source")
    if not isinstance(reader, dict) or reader.get("role") in ("postgres", "service_role", "anon", "authenticated", None):
        raise ExportRejected("unapproved_reader")
    if reader.get("authorized_tables") != sorted(REQUIRED_TABLES):
        raise ExportRejected("reader_missing_table")
    if reader.get("verified_by") != "independent_access_test":
        raise ExportRejected("reader_unverified")
    if not isinstance(signature, dict) or signature.get("algorithm") != "Ed25519":
        raise ExportRejected("signature_unverified")
    if signature.get("verification") != "verified_by_independent_trust_anchor":
        raise ExportRejected("signature_unverified")
    if not isinstance(signature.get("trusted_key_fingerprint"), str) or re.fullmatch(
        r"[0-9a-f]{64}", signature["trusted_key_fingerprint"]
    ) is None:
        raise ExportRejected("trust_anchor_missing")
    if signature.get("payload_sha256") != revision.get("proposal_sha256"):
        raise ExportRejected("signature_payload_mismatch")
    # This is a consistency gate only. It CANNOT verify a cryptographic signature,
    # role grants, or source hashes from self-supplied metadata.
    return {"status": "metadata_consistent_only", "authorized_export": False}
