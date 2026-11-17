#!/usr/bin/env python3
"""SECURITY-134: disposable SQLite concurrent writes, restart, crash and recovery tests."""
import os
import sqlite3
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

WORKER = ".github/scripts/test-security-130-sqlite-replay.py"
def run(db, scope, seq, digest):
    return subprocess.run([sys.executable,WORKER,"worker",db,scope,str(seq),digest],capture_output=True,text=True,timeout=30)

def inspect(db):
    c=sqlite3.connect(db)
    try:
        assert c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        rows=c.execute("SELECT scope,seq,digest FROM accepted ORDER BY scope,seq").fetchall()
        heads=dict(c.execute("SELECT scope,last_seq FROM heads").fetchall())
        for scope,seq,_ in rows:
            assert seq<=heads[scope]
        assert all(heads[s]==max(seq for scope,seq,_ in rows if scope==s) for s in heads)
        return rows,heads
    finally:c.close()

def tests():
    with tempfile.TemporaryDirectory(prefix="security134-") as directory:
        db=os.path.join(directory,"ledger.sqlite3")
        scope="game:2026020335"
        digest=lambda i: format(i,"064x")
        # Each contender has a different digest, but exactly one may claim the same sequence.
        with ThreadPoolExecutor(max_workers=12) as pool:
            attempts=list(pool.map(lambda i: run(db,scope,1,digest(i+1)),range(12)))
        assert sum(p.returncode==0 for p in attempts)==1,[(p.returncode,p.stderr) for p in attempts]
        rows,heads=inspect(db)
        assert len(rows)==1 and heads[scope]==1
        winner=rows[0][2]
        assert run(db,scope,1,winner).returncode!=0,"replay across process restart must fail"
        assert run(db,scope,2,winner).returncode!=0,"digest reuse must fail"
        assert run(db,scope,2,digest(100)).returncode==0,"new sequence must succeed"
        # A deliberately interrupted, uncommitted write cannot persist.
        crash=subprocess.run([sys.executable,"-c", """
import os,sqlite3,sys
c=sqlite3.connect(sys.argv[1],isolation_level=None)
c.execute('BEGIN IMMEDIATE')
c.execute('INSERT INTO accepted(scope,seq,digest) VALUES(?,?,?)',(sys.argv[2],3,sys.argv[3]))
os._exit(17)
""",db,scope,digest(101)],capture_output=True,text=True,timeout=15)
        assert crash.returncode==17
        rows,heads=inspect(db)
        assert len(rows)==2 and heads[scope]==2,"crash changed committed state"
        assert run(db,scope,3,digest(101)).returncode==0,"crashed write should be retryable"
        # A committed record must survive a new connection and independent process.
        assert run(db,scope,3,digest(101)).returncode!=0
        assert run(db,scope,2,digest(102)).returncode!=0,"sequence rollback"
        # Competing independent scopes must not interfere.
        with ThreadPoolExecutor(max_workers=6) as pool:
            independent=list(pool.map(lambda i: run(db,"game:"+str(i+1),1,digest(i+200)),range(6)))
        assert all(p.returncode==0 for p in independent),[(p.returncode,p.stderr) for p in independent]
        rows,heads=inspect(db)
        assert heads[scope]==3 and len(rows)==9
        # Corrupted files must fail closed: never silently create a valid replacement.
        corrupt=os.path.join(directory,"corrupt.sqlite3")
        with open(corrupt,"wb") as f:f.write(b"not a sqlite database")
        bad=run(corrupt,"game:bad",1,digest(500))
        assert bad.returncode!=0
        assert open(corrupt,"rb").read()==b"not a sqlite database"
        print("SECURITY-134 disposable SQLite contention, restart, crash rollback, isolation, corruption PASS")

if __name__=="__main__":tests()
