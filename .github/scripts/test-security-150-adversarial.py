#!/usr/bin/env python3
"""SECURITY-150 adversarial regression for SECURITY-149; offline only."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import sqlite3
import tempfile
import threading
import time

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

s=load("s149","security/local/security149-integrated-socket.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def run():
    with tempfile.TemporaryDirectory(prefix="security150-") as directory:
        db=str(Path(directory)/"ledger.sqlite3")
        keys=fixtures.setup(directory)
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        def request(epoch,rid):
            args=fixtures.args(directory,db,keys,epoch)
            return {key:args[key] for key in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}|{"request_id":rid}
        def exchange(payload,lifetime=2,delay=0,allowed=None):
            left,right=socket.socketpair()
            gate=s.pool.base.Gate();results=[]
            t=threading.Thread(target=lambda:results.append(s.handle(left,db,trust,{os.getuid()} if allowed is None else allowed,gate,lifetime=lifetime,delay=delay)))
            t.start()
            right.settimeout(3)
            try:
                right.sendall((json.dumps(payload)+"\n").encode())
                raw=right.recv(4096)
            except (OSError,TimeoutError):raw=b""
            finally:right.close();t.join(4)
            assert not t.is_alive(),"unbounded request"
            return results[0],json.loads(raw)["status"] if raw else None
        def envelope(req,op="submit"):return {"operation":op,"request":req}
        first=request(1,"a"*32)
        # Invalid signature, invalid signer, invalid UID, malformed request.
        bad=json.loads(json.dumps(first))
        bad["checkpoint_evidence"]["signature"]="A"*86+"=="
        assert exchange(envelope(bad))[0]=="rejected"
        assert exchange(envelope(first),allowed={os.getuid()+100000})[0]=="rejected"
        assert exchange({"operation":"submit","request":{}})[0]=="rejected"
        assert exchange(envelope(first,"remove"))[0]=="rejected"
        # Signed checkpoint may contain multiple heads; requested head MUST match epoch.
        mismatched=json.loads(json.dumps(first))
        mismatched["expected_epoch"]=2
        mismatched["anchor"]["epoch"]=2
        # Re-sign valid checkpoint/anchor for a different epoch, but keep the head at 1.
        original=fixtures.args(directory,db,keys,2)
        mismatched["anchor"]=original["anchor"]
        mismatched["anchor_evidence"]=original["anchor_evidence"]
        # A valid anchor from epoch 2 references a different checkpoint; build a matching one.
        import hashlib
        cp=first["checkpoint"]
        a={"version":1,"epoch":2,"checkpoint_digest":hashlib.sha256(fixtures.s.checkpoint_bytes(cp)).hexdigest()}
        mismatched["anchor"]=a
        mismatched["anchor_evidence"]=fixtures.sign(directory,"authority",fixtures.s.anchor_bytes(a))
        assert exchange(envelope(mismatched))[0]=="rejected"
        assert exchange(envelope(first))==("committed","committed")
        assert exchange(envelope(first))==("replayed","replayed")
        assert exchange(envelope(first,"reconcile"))==("committed","committed")
        second=request(2,"b"*32)
        # Kill child during artificial processing delay; later retry must recover.
        start=time.monotonic()
        assert exchange(envelope(second),lifetime=0.3,delay=2)[0]=="unknown"
        assert time.monotonic()-start<2
        assert exchange(envelope(second))==("committed","committed")
        assert exchange(envelope(second))==("replayed","replayed")
        # Post-commit lost response: close socket immediately after sending request.
        third=request(3,"c"*32)
        left,right=socket.socketpair()
        done=[]
        t=threading.Thread(target=lambda:done.append(s.handle(left,db,trust,{os.getuid()},s.pool.base.Gate())))
        t.start()
        right.sendall((json.dumps(envelope(third))+"\n").encode())
        right.close();t.join(5)
        assert not t.is_alive() and done==["committed"],done
        assert exchange(envelope(third,"reconcile"))==("committed","committed")
        assert exchange(envelope(third))==("replayed","replayed")
        # Concurrent independent sockets cannot commit the same epoch twice.
        fourth=request(4,"d"*32)
        results=[]
        threads=[threading.Thread(target=lambda:results.append(exchange(envelope(fourth))[0])) for _ in range(4)]
        for t in threads:t.start()
        for t in threads:t.join(8)
        assert len(results)==4 and results.count("committed")==1 and results.count("replayed")==3,results
        assert fixtures.rows(db)[0][1]==4
        # SQLite lock must not advance epoch or consume request ID.
        fifth=request(5,"e"*32)
        lock=sqlite3.connect(db,isolation_level=None)
        try:
            lock.execute("BEGIN IMMEDIATE")
            assert exchange(envelope(fifth),lifetime=0.5)[0] in ("unknown","rejected")
        finally:lock.rollback();lock.close()
        assert exchange(envelope(fifth))==("committed","committed")
        assert exchange(envelope(fifth,"reconcile"))==("committed","committed")
        assert fixtures.rows(db)[0][1]==5
        # Fixed limits from SECURITY-146 remain inherited.
        assert s.Server.__mro__[1] is s.pool.Server
        assert s.pool.MAX_WORKERS==2 and s.pool.MAX_QUEUE==2
        listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        try:
            try:s.Server(listener,db,trust,{os.getuid()},workers=3)
            except ValueError:pass
            else:raise AssertionError("worker limit bypass")
        finally:listener.close()
    print("SECURITY-150 signatures, UID, epoch binding, timeout, lost ACK, replay, concurrency, SQLite recovery PASS")

if __name__=="__main__":run()
