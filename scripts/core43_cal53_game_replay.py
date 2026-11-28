"""CAL-53 offline game binding and replay prevention (caller-owned ledger).

This gate does not access any database. A persistent, independently managed
replay ledger is REQUIRED for production-grade idempotency.
"""
from __future__ import annotations
from datetime import datetime, timezone
import re
from core43_cal52_source_binding import verify_sources, SourceRejected


class ReplayRejected(ValueError):
    pass


def _time(value):
    if not isinstance(value, str):
        raise ReplayRejected("missing_time")
    try:
        dt=datetime.fromisoformat(value.replace("Z","+00:00"))
    except ValueError as exc:
        raise ReplayRejected("bad_time") from exc
    if dt.tzinfo is None:
        raise ReplayRejected("naive_time")
    return dt.astimezone(timezone.utc)


def verify_game_bundle(*, expected_game_id: int, expected_teams: tuple[str,str],
                       expected_kickoff: str, seen_manifest_hashes: frozenset[str],
                       manifest, signature_b64, trusted_public_key_pem,
                       pinned_public_key_sha256, expected_manifest_sha256,
                       source_bytes):
    if not isinstance(expected_game_id,int) or isinstance(expected_game_id,bool) or expected_game_id<=0:
        raise ReplayRejected("invalid_game_id")
    if not isinstance(expected_teams,tuple) or len(expected_teams)!=2 or any(
        not isinstance(x,str) or re.fullmatch(r"[A-Z]{3}",x) is None for x in expected_teams
    ) or expected_teams[0]==expected_teams[1]:
        raise ReplayRejected("invalid_teams")
    if not isinstance(seen_manifest_hashes,frozenset):
        raise ReplayRejected("missing_replay_ledger")
    if expected_manifest_sha256 in seen_manifest_hashes:
        raise ReplayRejected("replayed_manifest")
    revision=manifest.get("revision") if isinstance(manifest,dict) else None
    if not isinstance(revision,dict):
        raise ReplayRejected("missing_revision")
    if revision.get("game_id")!=expected_game_id:
        raise ReplayRejected("game_mismatch")
    if revision.get("away_team")!=expected_teams[0] or revision.get("home_team")!=expected_teams[1]:
        raise ReplayRejected("team_mismatch")
    if _time(revision.get("kickoff_at"))!=_time(expected_kickoff):
        raise ReplayRejected("kickoff_mismatch")
    try:
        result=verify_sources(manifest=manifest,signature_b64=signature_b64,
            trusted_public_key_pem=trusted_public_key_pem,
            pinned_public_key_sha256=pinned_public_key_sha256,
            expected_manifest_sha256=expected_manifest_sha256,
            source_bytes=source_bytes)
    except SourceRejected as exc:
        raise ReplayRejected("invalid_signed_sources") from exc
    return {**result,"game_binding_verified":True,
        "replay_checked_against_caller_snapshot":True,
        "persistent_replay_prevention":False,"authorized_export":False}
