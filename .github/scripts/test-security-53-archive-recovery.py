#!/usr/bin/env python3
"""SECURITY-53: durable offline synthetic archive crash/retry/corruption test.
No production connections; uses temporary local SQLite file only.
"""
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()

def connect(path):
    db = sqlite3.connect(path, timeout=5, isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("""CREATE TABLE IF NOT EXISTS archive (
        game_id TEXT NOT NULL, input_sha TEXT NOT NULL,
        payload TEXT NOT NULL, payload_sha TEXT NOT NULL,
        PRIMARY KEY(game_id, input_sha))""")
    return db

def insert(db, record):
    body = canonical(record)
    checksum = sha(record)
    db.execute("BEGIN IMMEDIATE")
    try:
        existing = db.execute(
            "SELECT payload, payload_sha FROM archive WHERE game_id=? AND input_sha=?",
            (record["gameId"], record["inputSha"])).fetchone()
        if existing:
            if existing != (body, checksum):
                raise ValueError("conflicting duplicate")
            db.execute("COMMIT")
            return "idempotent"
        db.execute("INSERT INTO archive VALUES (?,?,?,?)",
                   (record["gameId"], record["inputSha"], body, checksum))
        db.execute("COMMIT")
        return "inserted"
    except BaseException:
        db.execute("ROLLBACK")
        raise

def verify(db):
    rows = db.execute("SELECT game_id,input_sha,payload,payload_sha FROM archive").fetchall()
    for game_id, input_sha, payload, checksum in rows:
        try:
            record = json.loads(payload)
        except (ValueError, TypeError):
            return False
        if (record.get("gameId") != game_id or record.get("inputSha") != input_sha
                or canonical(record) != payload or sha(record) != checksum):
            return False
    return True

with tempfile.TemporaryDirectory(prefix="security53-") as folder:
    path = str(Path(folder) / "synthetic-evidence.sqlite3")
    record = {"gameId":"synthetic-53","inputSha":"a"*64,
              "evidenceSha":"b"*64,"coefficients":[0,0.005,0.02,0.03],
              "production":False,"persistable":False}
    db = connect(path)
    assert insert(db, record) == "inserted"
    assert insert(db, record) == "idempotent"
    try:
        insert(db, {**record,"evidenceSha":"c"*64})
        raise AssertionError("conflicting duplicate accepted")
    except ValueError:
        pass
    assert verify(db)
    db.close()

    # Abrupt process exit with an open transaction: uncommitted row must vanish.
    child = """
import sqlite3, os, sys
db=sqlite3.connect(sys.argv[1], isolation_level=None)
db.execute('BEGIN IMMEDIATE')
db.execute("INSERT INTO archive VALUES ('crash','x','{}','y')")
os._exit(77)
"""
    crashed = subprocess.run([sys.executable, "-c", child, path], check=False)
    assert crashed.returncode == 77
    db = connect(path)
    assert db.execute("SELECT count(*) FROM archive").fetchone()[0] == 1
    assert verify(db)
    assert insert(db, record) == "idempotent", "recovery retry"
    assert db.execute("PRAGMA integrity_check").fetchone()[0] == "ok"

    # A committed malicious/corrupted row must fail archive verification.
    db.execute("UPDATE archive SET payload_sha=? WHERE game_id=?",
               ("0"*64, record["gameId"]))
    assert not verify(db), "corrupt checksum undetected"
    db.execute("UPDATE archive SET payload_sha=? WHERE game_id=?",
               (sha(record), record["gameId"]))
    assert verify(db)
    db.execute("UPDATE archive SET payload=? WHERE game_id=?",
               (canonical({**record, "evidenceSha":"tampered"}),record["gameId"]))
    assert not verify(db), "corrupt payload undetected"
    db.close()
print("PASS SECURITY-53 durable synthetic archive crash, dedup, retry and corruption")
