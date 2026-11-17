#!/usr/bin/env python3
"""SECURITY-142 socket isolation regression; synthetic Ed25519 keys only."""
import importlib.util
import json
import multiprocessing as mp
import os
from pathlib import Path
import sqlite3
import tempfile

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

writer=load("writer142","security/local/security142-isolated-writer.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def serve(sockpath,db,trust,ready,number):
    with writer.listener(sockpath) as sock:
        ready.set()
        for _ in range(number):writer.serve_once(sock,db,trust)

def run():
    with tempfile.TemporaryDirectory(prefix="security142-") as d:
        keys=fixtures.setup(d);db=str(Path(d)/"register.sqlite3")
        private=Path(d)/"private";private.mkdir(mode=0o700)
        path=str(private/"writer.sock")
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        one=fixtures.args(d,db,keys,1)
        two=fixtures.args(d,db,keys,2)
        def envelope(a):
            return {k:a[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        bad={**envelope(two),"anchor_evidence":{**two["anchor_evidence"],"signature":one["anchor_evidence"]["signature"]}}
        ready=mp.Event()
        p=mp.Process(target=serve,args=(path,db,trust,ready,6))
        p.start()
        assert ready.wait(10)
        try:
            assert not writer.request(path,{**envelope(one),"db":"/tmp/attacker.db"}),"client-controlled DB path accepted"
            assert writer.request(path,envelope(one))
            assert not writer.request(path,envelope(one)),"replay accepted"
            assert not writer.request(path,bad),"tampered anchor accepted"
            assert writer.request(path,envelope(two))
            assert not writer.request(path,{**envelope(two),"checkpoint_keys":{"issuer":keys["issuer"]}}),"client key override accepted"
        finally:
            p.join(20)
            if p.is_alive():p.terminate();p.join(5)
        assert p.exitcode==0
        assert fixtures.rows(db)[0][1]==2
        assert (Path(path).stat().st_mode&0o777)==0o600
        # This is intentionally a documented bypass: same-UID direct SQLite remains possible.
        with sqlite3.connect(db) as c:c.execute("UPDATE latest SET epoch=999")
        assert fixtures.rows(db)[0][1]==999
        print("SECURITY-142 socket framing, signed updates, bypass attempts and limitations PASS")

if __name__=="__main__":run()
