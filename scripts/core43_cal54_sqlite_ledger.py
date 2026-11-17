"""CAL-54: local SQLite idempotent reservation ledger.

Offline only. Atomic insert via UNIQUE digest, durable across process restarts.
Caller must verify CAL-53 bundle before recording. No Supabase access.
"""
from __future__ import annotations
import re
import sqlite3
from pathlib import Path


class LedgerError(ValueError):
    pass


def reserve_verified_manifest(db_path: str, *, digest: str, game_id: int,
                              verified: bool, authorized_export: bool = False) -> bool:
    """Return True for first reservation, False for an existing digest.

    Never accepts an export authorization. An external CAL-53 verification
    must be completed before this call; this function cannot prove it.
    """
    if not isinstance(verified, bool) or not verified or authorized_export:
        raise LedgerError("unverified_or_authorized_export")
    if not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None:
        raise LedgerError("invalid_digest")
    if not isinstance(game_id, int) or isinstance(game_id, bool) or game_id <= 0:
        raise LedgerError("invalid_game")
    if not isinstance(db_path, str) or not db_path:
        raise LedgerError("invalid_path")
    try:
        with sqlite3.connect(db_path, timeout=5) as con:
            con.execute("PRAGMA busy_timeout=5000")
            con.execute("""CREATE TABLE IF NOT EXISTS verified_manifests (
                digest TEXT PRIMARY KEY CHECK(length(digest)=64),
                game_id INTEGER NOT NULL CHECK(game_id>0),
                recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
            )""")
            cursor = con.execute(
                "INSERT OR IGNORE INTO verified_manifests (digest,game_id) VALUES (?,?)",
                (digest,game_id))
            if cursor.rowcount == 0:
                row = con.execute(
                    "SELECT game_id FROM verified_manifests WHERE digest=?", (digest,)).fetchone()
                if row is None or row[0] != game_id:
                    raise LedgerError("digest_game_conflict")
                return False
            return True
    except sqlite3.Error as exc:
        raise LedgerError("sqlite_failure") from exc


def seen_digests(db_path: str) -> frozenset[str]:
    if not isinstance(db_path, str) or not db_path:
        raise LedgerError("invalid_path")
    try:
        with sqlite3.connect(db_path, timeout=5) as con:
            rows=con.execute("SELECT digest FROM verified_manifests").fetchall()
            return frozenset(row[0] for row in rows)
    except sqlite3.Error as exc:
        raise LedgerError("sqlite_failure") from exc
