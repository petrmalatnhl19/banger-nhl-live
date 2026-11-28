"""CAL-55: verify signed game bundle, then atomically reserve its digest.

Offline only. Does not authorize exports, mutate Supabase or compute CORE.
"""
from __future__ import annotations
from core43_cal53_game_replay import verify_game_bundle, ReplayRejected
from core43_cal54_sqlite_ledger import reserve_verified_manifest, seen_digests, LedgerError


class PipelineRejected(ValueError):
    pass


def verify_and_reserve(*, db_path, expected_game_id, expected_teams,
                       expected_kickoff, manifest, signature_b64,
                       trusted_public_key_pem, pinned_public_key_sha256,
                       expected_manifest_sha256, source_bytes):
    try:
        seen = seen_digests(db_path)
    except LedgerError as exc:
        # Only allow a new database if its path does not exist; corrupt
        # existing ledgers fail closed rather than resetting replay history.
        from pathlib import Path
        if not isinstance(db_path,str) or Path(db_path).exists():
            raise PipelineRejected("ledger_unreadable") from exc
        seen = frozenset()
    try:
        verified = verify_game_bundle(
            expected_game_id=expected_game_id, expected_teams=expected_teams,
            expected_kickoff=expected_kickoff, seen_manifest_hashes=seen,
            manifest=manifest, signature_b64=signature_b64,
            trusted_public_key_pem=trusted_public_key_pem,
            pinned_public_key_sha256=pinned_public_key_sha256,
            expected_manifest_sha256=expected_manifest_sha256,
            source_bytes=source_bytes)
    except ReplayRejected as exc:
        raise PipelineRejected("verification_failed_or_replay") from exc
    try:
        inserted = reserve_verified_manifest(
            db_path, digest=expected_manifest_sha256,
            game_id=expected_game_id, verified=verified["verified"],
            authorized_export=False)
    except LedgerError as exc:
        raise PipelineRejected("ledger_write_failed") from exc
    if not inserted:
        raise PipelineRejected("duplicate_race")
    return {"status":"reserved_offline", "digest":expected_manifest_sha256,
            "verified":True, "authorized_export":False,
            "reader_permissions_verified":False}
