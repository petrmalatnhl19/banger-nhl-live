#!/usr/bin/env python3
"""SECURITY-149 end-to-end socket/child/signature/SQLite adversarial regression."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import tempfile
import threading
import time

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
s=load("s149","security/local/security149-integrated-socket.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def exchange(db,trust,request,operation="submit",lifetime=2,delay=0):
    left,right=socket.socketpair()
    result=[]
    gate=s.pool.base.Gate()
    t=threading.Thread(target=lambda:result.append(s.handle(left,db,trust,{os.getuid()},gate,lifetime=lifetime,delay=delay)))
    t.start()
    right.settimeout(4)
    try:
        right.sendall((json.dumps({"operation":operation,"request":request})+"\n").encode())
        response=right.recv(4096)
    except (ConnectionResetError,socket.timeout,BrokenPipeError):
        response=b""
    finally:
        right.close();t.join(4)
    assert not t.is_alive(),"worker exceeded deadline"
    return result[0],json.loads(response)["status"] if response else None

def run():
    with tempfile.TemporaryDirectory(prefix="security149-") as d:
        db=str(Path(d)/"ledger.sqlite3")
        keys=fixtures.setup(d)
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        def req(epoch,rid):
            a=fixtures.args(d,db,keys,epoch)
            return {k:a[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}|{"request_id":rid}
        first=req(1,"a"*32)
        assert exchange(db,trust,first)==("committed","committed")
        assert exchange(db,trust,first)==("replayed","replayed")
        assert exchange(db,trust,first,"reconcile")==("committed","committed")
        assert fixtures.rows(db)[0][1]==1
        bad=dict(first);bad["expected_epoch"]=99
        assert exchange(db,trust,bad)[0]=="rejected"
        second=req(2,"b"*32)
        # Deadline expires during child processing; a later signed retry succeeds.
        start=time.monotonic()
        assert exchange(db,trust,second,lifetime=0.3,delay=2)[0]=="unknown"
        assert time.monotonic()-start<1.8
        assert exchange(db,trust,second)==("committed","committed")
        assert exchange(db,trust,second,"reconcile")==("committed","committed")
        assert fixtures.rows(db)[0][1]==2
        # Concurrent submissions across sockets must yield one commit, other replays.
        third=req(3,"c"*32)
        results=[]
        threads=[threading.Thread(target=lambda:results.append(exchange(db,trust,third)[0])) for _ in range(4)]
        for t in threads:t.start()
        for t in threads:t.join(8)
        assert len(results)==4 and results.count("committed")==1 and results.count("replayed")==3,results
        assert fixtures.rows(db)[0][1]==3
        # Slow trickle must not evade the absolute read deadline.
        left,right=socket.socketpair();out=[]
        gate=s.pool.base.Gate()
        t=threading.Thread(target=lambda:out.append(s.handle(left,db,trust,{os.getuid()},gate,lifetime=0.3)))
        t.start()
        for _ in range(5):
            try:right.sendall(b"x")
            except (BrokenPipeError,ConnectionResetError):break
            time.sleep(0.1)
        right.close();t.join(3)
        assert not t.is_alive() and out[0] in ("unknown","rejected")
        assert fixtures.rows(db)[0][1]==3
    print("SECURITY-149 socket, signatures, deadline, child, replay, reconciliation, concurrency PASS")

if __name__=="__main__":run()
