#!/usr/bin/env python3
"""SECURITY-135: offline rollback detection with an independently preserved checkpoint."""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile

WORKER=".github/scripts/test-security-130-sqlite-replay.py"
SCOPE="game:2026020335"
def issue(db,sequence):
    return subprocess.run([sys.executable,WORKER,"worker",db,SCOPE,str(sequence),format(sequence,"064x")],capture_output=True,text=True,timeout=20).returncode==0

def read(db):
    c=sqlite3.connect(db)
    try:
        assert c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        rows=c.execute("SELECT scope,seq,digest FROM accepted ORDER BY scope,seq").fetchall()
        heads=c.execute("SELECT scope,last_seq FROM heads ORDER BY scope").fetchall()
        for scope,last_seq in heads:
            assert max(seq for s,seq,_ in rows if s==scope)==last_seq
        return rows,heads
    finally:c.close()

def checkpoint(db):
    rows,heads=read(db)
    canonical=json.dumps({"rows":rows,"heads":heads},separators=(",",":"),ensure_ascii=True)
    return {"digest":hashlib.sha256(canonical.encode()).hexdigest(),"heads":dict(heads)}

def restore_guard(db,independent):
    try:
        state=checkpoint(db)
        for scope,last in independent["heads"].items():
            if state["heads"].get(scope,0)<last:return False
        return state["digest"]==independent["digest"]
    except (sqlite3.DatabaseError,AssertionError,KeyError,TypeError,ValueError):
        return False

def tests():
    with tempfile.TemporaryDirectory(prefix="security135-") as directory:
        live=os.path.join(directory,"live.sqlite3")
        backup=os.path.join(directory,"backup.sqlite3")
        assert issue(live,1)
        shutil.copy2(live,backup)
        assert issue(live,2)
        independent=checkpoint(live)
        assert restore_guard(live,independent)
        # Backup predates the latest accepted issuance: fail closed.
        assert not restore_guard(backup,independent)
        # Naive restored ledger would accept the already-accepted second issuance.
        # Guard must deny access BEFORE any worker invocation.
        restored=os.path.join(directory,"restored.sqlite3")
        shutil.copy2(backup,restored)
        before=checkpoint(restored)
        if restore_guard(restored,independent):
            raise AssertionError("rollback was incorrectly trusted")
        assert checkpoint(restored)==before,"rejected restore must not mutate database"
        # Correct state remains acceptable; repeated issuance is rejected.
        assert not issue(live,2)
        assert issue(live,3)
        newer=checkpoint(live)
        assert not restore_guard(live,independent),"stale checkpoint must not authorize new state"
        assert restore_guard(live,newer)
        assert not restore_guard(backup,newer)
        # Independent checkpoint tampering is detected when digest no longer matches.
        changed={"digest":"0"*64,"heads":dict(newer["heads"])}
        assert not restore_guard(live,changed)
        corrupt=os.path.join(directory,"corrupt.sqlite3")
        with open(corrupt,"wb") as f:f.write(b"invalid database")
        assert not restore_guard(corrupt,newer)
        print("SECURITY-135 offline backup rollback and independent checkpoint guard PASS")

if __name__=="__main__":tests()
