#!/usr/bin/env python3
"""SECURITY-64: synthetic durable archive/checkpoint recovery after interrupted writes."""
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path


def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def digest(obj):
    return hashlib.sha256(canonical(obj).encode()).hexdigest()


def connect(path):
    db = sqlite3.connect(path, timeout=10, isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
    CREATE TABLE IF NOT EXISTS history (
      seq INTEGER PRIMARY KEY CHECK(seq > 0),
      prev_hash TEXT,
      archive_json TEXT NOT NULL,
      archive_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS anchor (
      id INTEGER PRIMARY KEY CHECK(id = 1),
      seq INTEGER NOT NULL,
      entry_hash TEXT NOT NULL
    );
    """)
    return db


def entry(seq, prev, archive):
    archive_hash = digest(archive)
    body = {"seq": seq, "prev_hash": prev, "archive_hash": archive_hash}
    return (seq, prev, canonical(archive), archive_hash, digest(body))


def append(db, row):
    db.execute("BEGIN IMMEDIATE")
    try:
        current = db.execute("SELECT seq, entry_hash FROM history ORDER BY seq DESC LIMIT 1").fetchone()
        if row[0] != (current[0] + 1 if current else 1):
            raise ValueError("sequence gap")
        if row[1] != (current[1] if current else None):
            raise ValueError("previous hash mismatch")
        db.execute("INSERT INTO history VALUES (?,?,?,?,?)", row)
        db.execute("INSERT INTO anchor VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET seq=excluded.seq,entry_hash=excluded.entry_hash", (row[0], row[4]))
        db.commit()
    except BaseException:
        db.rollback()
        raise


def verify(db):
    rows = db.execute("SELECT seq,prev_hash,archive_json,archive_hash,entry_hash FROM history ORDER BY seq").fetchall()
    anchor = db.execute("SELECT seq,entry_hash FROM anchor WHERE id=1").fetchone()
    if not rows or anchor != (rows[-1][0], rows[-1][4]):
        return False
    prev = None
    for index, (seq, prior, raw, ah, eh) in enumerate(rows, 1):
        try:
            archive = json.loads(raw)
        except (ValueError, TypeError):
            return False
        if seq != index or prior != prev or digest(archive) != ah:
            return False
        if digest({"seq": seq, "prev_hash": prior, "archive_hash": ah}) != eh:
            return False
        prev = eh
    return True


def child_crash(db_path, row):
    code = """
import json, sqlite3, os, sys
db=sqlite3.connect(sys.argv[1], isolation_level=None)
db.execute('PRAGMA journal_mode=WAL')
db.execute('PRAGMA synchronous=FULL')
row=json.loads(sys.argv[2])
db.execute('BEGIN IMMEDIATE')
db.execute('INSERT INTO history VALUES (?,?,?,?,?)',row)
db.execute('INSERT INTO anchor VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET seq=excluded.seq,entry_hash=excluded.entry_hash',(row[0],row[4]))
os._exit(77)
"""
    result = subprocess.run([sys.executable, "-c", code, str(db_path), json.dumps(row)], check=False)
    assert result.returncode == 77, result.returncode


def main():
    with tempfile.TemporaryDirectory(prefix="security64-") as temp:
        db_path = Path(temp) / "archive.sqlite3"
        db = connect(db_path)
        first = entry(1, None, {"game": "synthetic-64", "variant": [0, 0.005, 0.02, 0.03], "version": 1})
        append(db, first)
        assert verify(db)
        second = entry(2, first[4], {"game": "synthetic-64", "variant": [0, 0.005, 0.02, 0.03], "version": 2})
        db.close()
        child_crash(db_path, second)
        db = connect(db_path)
        assert verify(db), "committed state must survive writer crash"
        assert db.execute("SELECT count(*) FROM history").fetchone()[0] == 1, "uncommitted row must roll back"
        append(db, second)
        assert verify(db), "idempotent recovery should append only after validation"
        try:
            append(db, second)
            raise AssertionError("duplicate replay must fail")
        except ValueError:
            pass
        assert verify(db)
        db.close()
        db = connect(db_path)
        assert verify(db), "chain must verify after reopening database"
        db.execute("UPDATE history SET archive_json=? WHERE seq=2", (canonical({"game": "tampered"}),))
        assert not verify(db), "modified archive must fail validation"
        db.close()
    print("PASS SECURITY-64 durable SQLite WAL recovery, interrupted transaction, replay rejection and tamper detection")


if __name__ == "__main__":
    main()
