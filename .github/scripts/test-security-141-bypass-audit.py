#!/usr/bin/env python3
"""SECURITY-141: offline bypass inventory and adversarial filesystem boundary tests.

A filesystem permission gate is not a security boundary against the same OS user.
This audit fails closed when a new unreviewed SQLite write path appears in local modules.
"""
import ast
import os
from pathlib import Path
import sqlite3
import stat
import tempfile

ROOT=Path(__file__).resolve().parents[2]
EXPECTED_WRITERS={
 "security/local/security140-transaction-owner.py",
 ".github/scripts/test-security-130-sqlite-replay.py",
 ".github/scripts/test-security-134-sqlite-recovery.py",
 ".github/scripts/test-security-135-backup-rollback.py",
 ".github/scripts/test-security-138-anchor-register.py",
}
# These are documented test-only writers; no general production register path is authorized.
def sqlite_writers(path):
    try:tree=ast.parse(path.read_text(encoding="utf8"))
    except (SyntaxError,UnicodeError):return []
    aliases=set()
    for n in ast.walk(tree):
        if isinstance(n,ast.Import):
            for a in n.names:
                if a.name=="sqlite3":aliases.add(a.asname or "sqlite3")
        if isinstance(n,ast.ImportFrom) and n.module=="sqlite3":
            for a in n.names:
                if a.name=="connect":aliases.add(a.asname or "connect")
    found=[]
    for n in ast.walk(tree):
        if isinstance(n,ast.Call):
            f=n.func
            if isinstance(f,ast.Attribute) and f.attr=="connect" and isinstance(f.value,ast.Name) and f.value.id in aliases:found.append(n.lineno)
            if isinstance(f,ast.Name) and f.id in aliases and f.id!="sqlite3":found.append(n.lineno)
    return found

def audit():
    paths=[p for folder in ("security/local",".github/scripts") for p in (ROOT/folder).rglob("*.py")]
    inventory={}
    for path in paths:
        found=sqlite_writers(path)
        if found:inventory[str(path.relative_to(ROOT))]=found
    unexpected={k:v for k,v in inventory.items() if k not in EXPECTED_WRITERS}
    assert not any(k.startswith("security/local/") for k in unexpected),f"unreviewed local security SQLite connection sites: {unexpected}"
    if unexpected:print("SECURITY-141 additional test-only SQLite connections requiring review:",unexpected)
    assert "security/local/security140-transaction-owner.py" in inventory
    assert ".github/scripts/test-security-138-anchor-register.py" in inventory,"known direct bypass must remain visible in inventory"
    print("SECURITY-141 SQLite connection inventory:",inventory)
    print("SECURITY-141 known bypass: SECURITY-138 update() accepts unsigned writes; OS-user file access bypasses Python signature gate")

def adversarial():
    with tempfile.TemporaryDirectory(prefix="security141-") as d:
        db=Path(d)/"register.sqlite3"
        with sqlite3.connect(db) as c:
            c.execute("CREATE TABLE latest(scope TEXT PRIMARY KEY,epoch INTEGER,fingerprint TEXT)")
            c.execute("INSERT INTO latest VALUES(?,?,?)",("game:2026020335",1,"a"*64))
        # Demonstrate the bypass rather than claiming read-only filesystem mode prevents it.
        with sqlite3.connect(db) as c:
            c.execute("UPDATE latest SET epoch=999 WHERE scope=?",("game:2026020335",))
        with sqlite3.connect(db) as c:
            assert c.execute("SELECT epoch FROM latest").fetchone()[0]==999
        # Verify read-only URI connections cannot update the database via that connection.
        uri=db.resolve().as_uri()+"?mode=ro"
        with sqlite3.connect(uri,uri=True) as c:
            try:c.execute("UPDATE latest SET epoch=1000")
            except sqlite3.OperationalError:pass
            else:raise AssertionError("read-only URI unexpectedly permitted UPDATE")
        # POSIX permission check: mode 0600 limits other UIDs but does not isolate same UID.
        os.chmod(db,stat.S_IRUSR|stat.S_IWUSR)
        assert stat.S_IMODE(db.stat().st_mode)==0o600
        with sqlite3.connect(db) as c:
            c.execute("UPDATE latest SET epoch=1001")
        with sqlite3.connect(db) as c:
            assert c.execute("SELECT epoch FROM latest").fetchone()[0]==1001
    print("SECURITY-141 adversarial bypass, readonly URI and same-user permission limits PASS")

if __name__=="__main__":
    audit()
    adversarial()
