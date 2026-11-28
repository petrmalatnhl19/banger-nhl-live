#!/usr/bin/env python3
"""SECURITY-143 Linux distinct-UID offline integration. Requires passwordless sudo."""
import importlib.util
import multiprocessing as mp
import os
from pathlib import Path
import pwd
import sqlite3
import subprocess
import sys
import tempfile

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

writer=load("writer142","security/local/security142-isolated-writer.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def serve(sockpath,db,trust,ready):
    with writer.listener(sockpath) as sock:
        # Cross-UID clients can reach this demo socket. Signed envelope remains mandatory.
        os.chmod(sockpath,0o666)
        ready.set()
        for _ in range(2):writer.serve_once(sock,db,trust)

CLIENT=r'''
import json,os,socket,sqlite3,sys
db,sock,payload=sys.argv[1:]
try:
 sqlite3.connect("file:"+db+"?mode=rw",uri=True).execute("UPDATE latest SET epoch=999")
 raise AssertionError("direct SQLite update was permitted")
except sqlite3.OperationalError:pass
s=socket.socket(socket.AF_UNIX)
s.settimeout(5);s.connect(sock);s.sendall(payload.encode()+b"\n");s.shutdown(socket.SHUT_WR)
reply=json.loads(s.makefile("rb").readline());s.close()
print(json.dumps(reply))
'''

def run():
    if sys.platform!="linux":raise RuntimeError("SECURITY-143 requires Linux")
    if subprocess.run(["sudo","-n","-u","nobody","id","-u"],capture_output=True).returncode!=0:
        raise RuntimeError("SECURITY-143 requires sudo -n -u nobody; do not silently skip")
    assert pwd.getpwnam("nobody").pw_uid!=os.getuid(),"test identities must differ"
    with tempfile.TemporaryDirectory(prefix="security143-") as d:
        root=Path(d);root.chmod(0o755)
        dbdir=root/"db";dbdir.mkdir(mode=0o700)
        sockdir=root/"ipc";sockdir.mkdir(mode=0o700)
        db=str(dbdir/"register.sqlite3");sock=str(sockdir/"writer.sock")
        keys=fixtures.setup(d)
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        valid=fixtures.args(d,db,keys,1)
        envelope={k:valid[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        # Test harness opens the socket directory for traversal; DB directory remains private.
        ready=mp.Event();p=mp.Process(target=serve,args=(sock,db,trust,ready));p.start()
        assert ready.wait(10)
        sockdir.chmod(0o711)
        try:
            for payload,expected in ((envelope,True),(envelope,False)):
                result=subprocess.run(["sudo","-n","-u","nobody",sys.executable,"-c",CLIENT,db,sock,__import__("json").dumps(payload)],capture_output=True,text=True,timeout=20)
                assert result.returncode==0,(result.stdout,result.stderr)
                assert __import__("json").loads(result.stdout)["accepted"] is expected
        finally:
            p.join(20)
            if p.is_alive():p.terminate();p.join(5)
        assert p.exitcode==0
        assert fixtures.rows(db)[0][1]==1
        assert dbdir.stat().st_mode&0o777==0o700
        print("SECURITY-143 distinct-UID direct SQLite denial, socket signed acceptance and replay rejection PASS")

if __name__=="__main__":run()
