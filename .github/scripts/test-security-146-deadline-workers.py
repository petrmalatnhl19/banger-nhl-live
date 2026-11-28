#!/usr/bin/env python3
"""SECURITY-146 adversarial trickle and bounded-worker regression."""
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

s=load("s146","security/local/security146-deadline-workers.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")
writer=load("writer142","security/local/security142-isolated-writer.py")

def connect(path):
    c=socket.socket(socket.AF_UNIX);c.settimeout(3);c.connect(path);return c

def run():
    with tempfile.TemporaryDirectory(prefix="security146-") as d:
        keys=fixtures.setup(d)
        db=str(Path(d)/"register.sqlite3")
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        one=fixtures.args(d,db,keys,1)
        payload={k:one[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        ipc=Path(d)/"ipc";ipc.mkdir(mode=0o700)
        path=str(ipc/"writer.sock")
        with writer.listener(path) as listener:
            gate=s.base.Gate()
            # Continuous trickle: each chunk arrives within idle timeout but total exceeds deadline.
            left,right=socket.socketpair()
            # socketpair has same-UID Linux SO_PEERCRED.
            outcome=[]
            t=threading.Thread(target=lambda:outcome.append(s.handle(left,db,trust,{os.getuid()},gate,deadline_seconds=0.35)))
            t.start()
            for _ in range(5):
                try:right.sendall(b"x")
                except (BrokenPipeError,ConnectionResetError):break
                time.sleep(0.12)
            right.close();t.join(3)
            assert not t.is_alive() and outcome==[False],"trickle must expire absolute deadline"
            # Valid signed request still succeeds.
            server=s.Server(listener,db,trust,{os.getuid()},workers=2,pending=2)
            thread=threading.Thread(target=lambda:server.serve(1));thread.start()
            with connect(path) as conn:
                conn.sendall(json.dumps(payload).encode()+b"\n")
                conn.shutdown(socket.SHUT_WR)
                response=conn.recv(1024)
                assert json.loads(response)["accepted"]
            thread.join(5);assert not thread.is_alive()
            assert fixtures.rows(db)[0][1]==1
            # Bounded resources are structural, and invalid configurations fail closed.
            assert len(server.threads)==2 and server.pending.maxsize==2
            for workers,pending in [(0,1),(3,1),(1,0),(1,3)]:
                try:s.Server(listener,db,trust,{os.getuid()},workers=workers,pending=pending)
                except ValueError:pass
                else:raise AssertionError("invalid worker bounds accepted")
    print("SECURITY-146 trickle absolute deadline, signed update and bounded pool PASS")

if __name__=="__main__":run()
