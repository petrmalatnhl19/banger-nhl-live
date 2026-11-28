#!/usr/bin/env python3
"""SECURITY-130: disposable SQLite replay transaction test. NOT a production verifier."""
import os
import sqlite3
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

SCHEMA = """
CREATE TABLE IF NOT EXISTS accepted (
  scope TEXT NOT NULL,
  seq INTEGER NOT NULL CHECK(seq > 0),
  digest TEXT NOT NULL CHECK(length(digest)=64),
  PRIMARY KEY(scope,seq),
  UNIQUE(scope,digest)
);
CREATE TABLE IF NOT EXISTS heads (
  scope TEXT PRIMARY KEY,
  last_seq INTEGER NOT NULL CHECK(last_seq > 0)
);
"""

def connect(db):
    c=sqlite3.connect(db,timeout=5,isolation_level=None)
    c.execute("PRAGMA busy_timeout=5000")
    c.execute("PRAGMA synchronous=FULL")
    c.executescript(SCHEMA)
    return c

def accept(db,scope,seq,digest,verified=False):
    # 'verified' is an external synthetic fixture flag, NOT cryptographic proof.
    if verified is not True or not isinstance(scope,str) or not scope or len(scope)>128:
        return False
    if not isinstance(seq,int) or isinstance(seq,bool) or seq<=0:
        return False
    if not isinstance(digest,str) or len(digest)!=64 or any(c not in "0123456789abcdef" for c in digest):
        return False
    c=connect(db)
    try:
        c.execute("BEGIN IMMEDIATE")
        old=c.execute("SELECT last_seq FROM heads WHERE scope=?",(scope,)).fetchone()
        if old is not None and seq<=old[0]:
            c.execute("ROLLBACK")
            return False
        c.execute("INSERT INTO accepted(scope,seq,digest) VALUES(?,?,?)",(scope,seq,digest))
        c.execute("INSERT INTO heads(scope,last_seq) VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET last_seq=excluded.last_seq",(scope,seq))
        c.execute("COMMIT")
        return True
    except (sqlite3.DatabaseError,sqlite3.OperationalError):
        if c.in_transaction:
            c.execute("ROLLBACK")
        return False
    finally:
        c.close()

def worker(db,scope,seq,digest):
    return accept(db,scope,seq,digest,True)

def tests():
    with tempfile.TemporaryDirectory(prefix="security130-") as d:
        db=os.path.join(d,"ledger.sqlite3")
        assert not accept(db,"game:1",1,"a"*64)
        assert accept(db,"game:1",1,"a"*64,True)
        assert not accept(db,"game:1",1,"a"*64,True)
        assert not accept(db,"game:1",2,"a"*64,True)
        assert not accept(db,"game:1",0,"b"*64,True)
        assert not accept(db,"game:1",2,"B"*64,True)
        assert accept(db,"game:2",1,"a"*64,True), "separate scopes have independent sequences"
        assert accept(db,"game:1",2,"b"*64,True), "restart preserves committed sequence"
        assert not accept(db,"game:1",1,"c"*64,True)
        # Separate OS processes compete for the exact same scoped issuance.
        cmd=[sys.executable,__file__,"worker",db,"game:race","1","c"*64]
        with ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _: subprocess.run(cmd,capture_output=True,text=True,timeout=20),range(8)))
        assert sum(p.returncode==0 for p in results)==1, [(p.returncode,p.stderr) for p in results]
        c=connect(db)
        try:
            assert c.execute("SELECT COUNT(*) FROM accepted WHERE scope='game:race'").fetchone()[0]==1
            assert c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
            # Simulated uncommitted crash: rollback on connection loss.
            c.execute("BEGIN IMMEDIATE")
            c.execute("INSERT INTO accepted(scope,seq,digest) VALUES(?,?,?)",("game:crash",1,"d"*64))
            c.close()
            assert accept(db,"game:crash",1,"d"*64,True)
        finally:
            try:c.close()
            except Exception:pass
        assert not accept(db,"game:race",1,"e"*64,True)
        assert accept(db,"game:race",2,"e"*64,True)
        print("SECURITY-130 disposable SQLite: duplicate, scoped sequence, restart, multiprocess race, rollback PASS")

if __name__=="__main__":
    if len(sys.argv)==6 and sys.argv[1]=="worker":
        sys.exit(0 if worker(sys.argv[2],sys.argv[3],int(sys.argv[4]),sys.argv[5]) else 1)
    tests()
