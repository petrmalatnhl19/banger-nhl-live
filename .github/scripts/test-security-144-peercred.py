#!/usr/bin/env python3
"""SECURITY-144 peer credential allowlist regression (Linux CI)."""
import importlib.util
import json
import multiprocessing as mp
import os
from pathlib import Path
import pwd
import subprocess
import sys
import tempfile

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

peer=load("peer144","security/local/security144-peercred-writer.py")
socket_writer=load("socket142","security/local/security142-isolated-writer.py")
fixtures=load("fixtures140",".github/scripts/test-security-140-transaction-owner.py")

def serve(path,db,trust,allowed,ready,count):
    with socket_writer.listener(path) as sock:
        os.chmod(path,0o666)
        ready.set()
        for _ in range(count):peer.serve_once(sock,db,trust,set(allowed))

CLIENT=r'''
import json,socket,sys
sock,payload=sys.argv[1:]
s=socket.socket(socket.AF_UNIX);s.settimeout(5);s.connect(sock)
s.sendall(payload.encode()+b"\n");s.shutdown(socket.SHUT_WR)
print(s.makefile("rb").readline().decode().strip());s.close()
'''

def call(path,payload,other=False):
    command=[sys.executable,"-c",CLIENT,path,json.dumps(payload)]
    if other:command=["sudo","-n","-u","nobody",*command]
    result=subprocess.run(command,capture_output=True,text=True,timeout=20)
    assert result.returncode==0,(result.stdout,result.stderr)
    return json.loads(result.stdout)["accepted"]

def run():
    assert sys.platform.startswith("linux") and hasattr(__import__("socket"),"SO_PEERCRED")
    assert subprocess.run(["sudo","-n","-u","nobody","id","-u"],capture_output=True).returncode==0
    assert os.getuid()!=pwd.getpwnam("nobody").pw_uid
    with tempfile.TemporaryDirectory(prefix="security144-") as d:
        root=Path(d);root.chmod(0o755)
        private=root/"db";private.mkdir(mode=0o700)
        ipc=root/"ipc";ipc.mkdir(mode=0o700)
        db=str(private/"register.sqlite3");path=str(ipc/"writer.sock")
        keys=fixtures.setup(d)
        trust={"checkpoint_keys":{"issuer":keys["issuer"]},"checkpoint_active":["issuer"],"anchor_keys":{"authority":keys["authority"]},"anchor_active":["authority"]}
        one=fixtures.args(d,db,keys,1)
        two=fixtures.args(d,db,keys,2)
        envelope=lambda a:{k:a[k] for k in ("scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch")}
        ready=mp.Event()
        process=mp.Process(target=serve,args=(path,db,trust,[os.getuid()],ready,4))
        process.start();assert ready.wait(10)
        ipc.chmod(0o711)
        try:
            assert not call(path,envelope(one),other=True),"unauthorized UID accepted signed request"
            assert call(path,envelope(one)),"authorized UID rejected"
            assert not call(path,envelope(two),other=True),"unauthorized UID accepted epoch 2"
            assert call(path,envelope(two)),"authorized UID rejected epoch 2"
        finally:
            process.join(20)
            if process.is_alive():process.terminate();process.join(5)
        assert process.exitcode==0
        assert fixtures.rows(db)[0][1]==2
        print("SECURITY-144 SO_PEERCRED unauthorized UID rejection, authorized signed update PASS")

if __name__=="__main__":run()
