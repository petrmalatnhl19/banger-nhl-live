#!/usr/bin/env python3
"""SECURITY-148 offline ambiguous commit, replay, concurrency and recovery."""
import importlib.util
import multiprocessing as mp
import os
from pathlib import Path
import sqlite3
import tempfile

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod

s=load("s148","security/local/security148-idempotent-owner.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def concurrent(arg):
    db,trust,request=arg
    return s.submit(db,trust,request)

def run():
    with tempfile.TemporaryDirectory(prefix="security148-") as d:
        db=str(Path(d)/"ledger.sqlite3")
        keys=fixtures.setup(d)
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        def req(epoch,rid):
            a=fixtures.args(d,db,keys,epoch)
            return {k:a[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}|{"request_id":rid}
        first=req(1,"a"*32)
        assert s.reconcile(db,trust,first)=="unknown"
        # Fault injected after COMMIT but before acknowledgement; recovery must find receipt.
        try:
            s.submit(db,trust,first,after_commit=lambda:(_ for _ in ()).throw(RuntimeError("lost response")))
        except RuntimeError:pass
        else:raise AssertionError("fault injection failed")
        assert s.reconcile(db,trust,first)=="committed"
        assert s.submit(db,trust,first)=="replayed"
        assert fixtures.rows(db)[0][1]==1
        second=req(2,"b"*32)
        with mp.get_context("fork").Pool(4) as pool:
            results=pool.map(concurrent,[(db,trust,second)]*8)
        assert results.count("committed")==1 and results.count("replayed")==7,results
        assert fixtures.rows(db)[0][1]==2
        assert s.reconcile(db,trust,second)=="committed"
        # Collision on request id with different signed content cannot claim old receipt.
        collision=req(3,"b"*32)
        assert s.submit(db,trust,collision)=="rejected"
        assert s.reconcile(db,trust,collision)=="rejected"
        assert s.reconcile(db,trust,req(3,"c"*32))=="unknown"
        # Signed payload tampering must not reveal receipt or update state.
        forged=dict(second);forged["expected_epoch"]=99
        assert s.reconcile(db,trust,forged)=="rejected"
        assert s.submit(db,trust,forged)=="rejected"
        # Recover from SQLite lock without consuming request id.
        third=req(3,"c"*32)
        lock=sqlite3.connect(db,isolation_level=None)
        try:
            lock.execute("BEGIN IMMEDIATE")
            assert s.submit(db,trust,third)=="rejected"
        finally:lock.rollback();lock.close()
        assert s.submit(db,trust,third)=="committed"
        assert s.reconcile(db,trust,third)=="committed"
        assert fixtures.rows(db)[0][1]==3
    print("SECURITY-148 ambiguous commit, replay, concurrency, collision, lock recovery PASS")

if __name__=="__main__":run()
