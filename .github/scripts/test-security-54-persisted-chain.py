#!/usr/bin/env python3
"""SECURITY-54: verify persistent four-variant archive replay and integrity offline."""
import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

def canonical(v):
    return json.dumps(v, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def sha(v):
    return hashlib.sha256(canonical(v).encode()).hexdigest()

def produce():
    # Use the real experimental calculator, not mocked prediction values.
    js = r"""
const {calculateShadow}=require('./scripts/core43_gsax_sensitivity.cjs');
const baseline={away:2.8,home:3.2,predictedAt:'2026-11-16T18:00:00Z'};
const awayGoalie={id:'A',available:true,value:{gsaxPer100Shots:2,shotsAgainst:200,fetchedAt:'2026-11-16T18:30:00Z'}};
const homeGoalie={id:'B',available:true,value:{gsaxPer100Shots:-1,shotsAgainst:200,fetchedAt:'2026-11-16T18:40:00Z'}};
const source={gameId:'synthetic-54',status:'scheduled',cutoff:'2026-11-16T19:00:00Z',
 kickoff:'2026-11-16T20:00:00Z',baseline,awayGoalie,homeGoalie,
 evidence:{sourceId:'synthetic-provider',publishedAt:'2026-11-16T18:10:00Z',
  witnessedAt:'2026-11-16T18:45:00Z'}};
const cutoff=Date.parse(source.cutoff);
if(source.status!=='scheduled'||Date.parse(source.kickoff)<=cutoff||
 [baseline.predictedAt,awayGoalie.value.fetchedAt,homeGoalie.value.fetchedAt,
  source.evidence.publishedAt,source.evidence.witnessedAt].some(t=>Date.parse(t)>cutoff))
 throw Error('invalid pregame evidence');
const records=[0,0.005,0.02,0.03].map(coefficient=>{
 const r=calculateShadow({baseline,awayGoalie,homeGoalie,asOf:source.cutoff,coefficient});
 if(!r.available)throw Error('engine unavailable');
 return {coefficient,away:r.expectedAwayGoals,home:r.expectedHomeGoals,
  engine:r.model,calibrated:false,production:false,persistable:false};
});
process.stdout.write(JSON.stringify({source,records,production:false,writeEnabled:false}));
"""
    result = subprocess.run(["node", "-e", js], check=True, capture_output=True, text=True)
    return json.loads(result.stdout)

def verify(archive):
    if archive.get("production") is not False or archive.get("writeEnabled") is not False:
        return False
    source = archive.get("source", {})
    rows = archive.get("records", [])
    if source.get("gameId") != "synthetic-54" or len(rows) != 4:
        return False
    if [r.get("coefficient") for r in rows] != [0, 0.005, 0.02, 0.03]:
        return False
    return all(r.get("production") is False and r.get("persistable") is False for r in rows)

def connect(path):
    db = sqlite3.connect(path, isolation_level=None)
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA synchronous=FULL")
    db.execute("""CREATE TABLE IF NOT EXISTS archives
      (game_id TEXT PRIMARY KEY, body TEXT NOT NULL, body_sha TEXT NOT NULL)""")
    return db

def save(db, archive):
    if not verify(archive):
        raise ValueError("invalid archive")
    game_id = archive["source"]["gameId"]
    body = canonical(archive)
    digest = sha(archive)
    db.execute("BEGIN IMMEDIATE")
    try:
        row = db.execute("SELECT body,body_sha FROM archives WHERE game_id=?", (game_id,)).fetchone()
        if row is None:
            db.execute("INSERT INTO archives VALUES (?,?,?)", (game_id, body, digest))
            outcome = "inserted"
        elif row == (body, digest):
            outcome = "idempotent"
        else:
            raise ValueError("conflicting archive")
        db.execute("COMMIT")
        return outcome
    except BaseException:
        db.execute("ROLLBACK")
        raise

def load_verified(db):
    row = db.execute("SELECT game_id,body,body_sha FROM archives").fetchone()
    if row is None:
        raise ValueError("missing archive")
    game_id, body, digest = row
    archive = json.loads(body)
    if body != canonical(archive) or digest != sha(archive) or not verify(archive) or archive["source"]["gameId"] != game_id:
        raise ValueError("archive corrupted")
    return archive

with tempfile.TemporaryDirectory(prefix="security54-") as folder:
    path = str(Path(folder) / "archive.sqlite")
    original = produce()
    assert verify(original)
    db = connect(path)
    assert save(db, original) == "inserted"
    db.close()
    db = connect(path)
    restored = load_verified(db)
    assert restored == original
    assert save(db, original) == "idempotent"
    assert produce() == restored, "experimental engine replay differs"
    try:
        save(db, {**original, "records": [{**original["records"][0], "home": 9}] + original["records"][1:]})
        raise AssertionError("conflicting archive accepted")
    except ValueError:
        pass
    assert load_verified(db) == original
    db.execute("UPDATE archives SET body_sha=? WHERE game_id=?", ("0"*64, "synthetic-54"))
    try:
        load_verified(db)
        raise AssertionError("corrupted archive accepted")
    except ValueError:
        pass
    db.close()
print("PASS SECURITY-54 persisted four-variant archive, restart, replay and corruption rejection")
