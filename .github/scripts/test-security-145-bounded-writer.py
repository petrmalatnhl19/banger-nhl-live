#!/usr/bin/env python3
"""SECURITY-145 adversarial bounds and signed request regression."""
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
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

s=load("bounded145","security/local/security145-bounded-writer.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")
writer=load("writer142","security/local/security142-isolated-writer.py")

def client(path,payload):
    with socket.socket(socket.AF_UNIX) as conn:
        conn.settimeout(2)
        conn.connect(path)
        conn.sendall(payload)
        conn.shutdown(socket.SHUT_WR)
        try:\n            return conn.recv(1024)\n        except ConnectionResetError:\n            # A rejected oversized request can reset the connection on Linux.\n            return b""

def run():
    now=[0.0]
    gate=s.Gate(clock=lambda:now[0])
    uid=os.getuid()
    assert gate.acquire(uid)
    assert gate.acquire(uid)
    assert not gate.acquire(uid),"concurrent cap bypass"
    gate.release()
    assert gate.acquire(uid)
    gate.release()
    assert not gate.acquire(uid),"per-UID rate limit bypass"
    gate.release()
    now[0]=2.0
    assert gate.acquire(uid),"window failed to expire"
    gate.release()
    with tempfile.TemporaryDirectory(prefix="security145-") as d:
        keys=fixtures.setup(d)
        db=str(Path(d)/"register.sqlite3")
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        one=fixtures.args(d,db,keys,1)
        payload={k:one[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        ipc=Path(d)/"ipc";ipc.mkdir(mode=0o700)
        path=str(ipc/"writer.sock")
        with writer.listener(path) as listener:
            admission=s.Gate()
            def serve():s.serve_once(listener,db,trust,{uid},admission)
            thread=threading.Thread(target=serve);thread.start()
            reply=client(path,json.dumps(payload).encode()+b"\n")
            thread.join(10);assert not thread.is_alive()
            assert json.loads(reply)["accepted"] is True
            assert fixtures.rows(db)[0][1]==1
            # Oversized framing rejected without database mutation.
            thread=threading.Thread(target=serve);thread.start()
            client(path,b"x"*(s.MAX_BYTES+1)+b"\n")
            thread.join(10);assert not thread.is_alive()
            assert fixtures.rows(db)[0][1]==1
            # Slow authorized peer gets bounded read timeout, not indefinite hang.
            thread=threading.Thread(target=serve);thread.start()
            with socket.socket(socket.AF_UNIX) as conn:
                conn.connect(path)
                start=time.monotonic()
                thread.join(3)
                assert not thread.is_alive() and time.monotonic()-start<3,"slow client blocked worker"
            assert fixtures.rows(db)[0][1]==1
            # A signed replay must still fail after gate window resets.
            time.sleep(s.WINDOW+0.1)
            thread=threading.Thread(target=serve);thread.start()
            reply=client(path,json.dumps(payload).encode()+b"\n")
            thread.join(10);assert not thread.is_alive()
            assert json.loads(reply)["accepted"] is False
            assert fixtures.rows(db)[0][1]==1
    print("SECURITY-145 rate/concurrency, oversized, slow-client, signed and replay checks PASS")

if __name__=="__main__":run()
