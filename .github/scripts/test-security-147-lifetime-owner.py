#!/usr/bin/env python3
"""SECURITY-147 signed subprocess lifetime, stuck-worker and SQLite lock tests."""
import importlib.util
import json
import multiprocessing as mp
import os
from pathlib import Path
import socket
import sqlite3
import tempfile
import time

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

s=load("s147","security/local/security147-lifetime-owner.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def run():
    with tempfile.TemporaryDirectory(prefix="security147-") as d:
        keys=fixtures.setup(d)
        db=str(Path(d)/"register.sqlite3")
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        one=fixtures.args(d,db,keys,1)
        two=fixtures.args(d,db,keys,2)
        envelope=lambda a:{k:a[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        assert s.bounded_submit(db,trust,envelope(one)) is True,"signed write failed"
        assert fixtures.rows(db)[0][1]==1
        assert s.bounded_submit(db,trust,envelope(one)) is False,"replay accepted"
        start=time.monotonic()
        assert s.bounded_submit(db,trust,envelope(two),seconds=0.35,delay=3) is False
        assert time.monotonic()-start<2,"stuck verification child not terminated"
        assert fixtures.rows(db)[0][1]==1,"timed-out child wrote database"
        # SQLite BEGIN IMMEDIATE held by independent connection: child must be terminated
        # instead of waiting through the owner's default 15-second busy_timeout.
        lock=sqlite3.connect(db,isolation_level=None)
        try:
            lock.execute("BEGIN IMMEDIATE")
            start=time.monotonic()
            assert s.bounded_submit(db,trust,envelope(two),seconds=0.6) is False
            assert time.monotonic()-start<2,"locked SQLite exceeded budget"
        finally:lock.rollback();lock.close()
        assert fixtures.rows(db)[0][1]==1
        assert s.bounded_submit(db,trust,envelope(two)) is True
        assert fixtures.rows(db)[0][1]==2
        # Whole connection deadline covers trickle receive and cannot mutate DB.
        left,right=socket.socketpair()
        gate=s.previous.base.Gate()
        import threading
        outcome=[]
        t=threading.Thread(target=lambda:outcome.append(s.handle(left,db,trust,{os.getuid()},gate,lifetime=0.35)))
        t.start()
        for _ in range(5):
            try:right.sendall(b"x")
            except (BrokenPipeError,ConnectionResetError):break
            time.sleep(0.12)
        right.close();t.join(3)
        assert not t.is_alive() and outcome==[False]
        assert fixtures.rows(db)[0][1]==2
    print("SECURITY-147 signed/replay, stuck worker, SQLite lock, deadline and recovery PASS")

if __name__=="__main__":run()
