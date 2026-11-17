#!/usr/bin/env python3
"""SECURITY-140 offline adversarial and recovery regression."""
import base64
import hashlib
import importlib.util
import json
import multiprocessing as mp
import os
from pathlib import Path
import sqlite3
import subprocess
import tempfile

spec=importlib.util.spec_from_file_location("s140","security/local/security140-transaction-owner.py")
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
SCOPE="game:2026020335"

def openssl(*args):
    r=subprocess.run(["openssl",*map(str,args)],capture_output=True,timeout=10)
    assert r.returncode==0,r.stderr.decode()
    return r.stdout

def setup(directory):
    d=Path(directory)
    for name in ("issuer","authority","attacker"):
        openssl("genpkey","-algorithm","ED25519","-out",d/(name+".pem"))
        openssl("pkey","-in",d/(name+".pem"),"-pubout","-out",d/(name+".pub"))
    return {name:(d/(name+".pub")).read_text() for name in ("issuer","authority","attacker")}

def sign(directory,name,payload):
    d=Path(directory)
    (d/"payload").write_bytes(payload)
    openssl("pkeyutl","-sign","-inkey",d/(name+".pem"),"-rawin","-in",d/"payload","-out",d/"signature")
    return {"algorithm":"Ed25519","key_id":name,"signature":base64.b64encode((d/"signature").read_bytes()).decode()}

def args(directory,db,keys,epoch,scope=SCOPE):
    c={"version":1,"digest":format(epoch,"064x"),"heads":{scope:epoch}}
    a={"version":1,"epoch":epoch,"checkpoint_digest":hashlib.sha256(s.checkpoint_bytes(c)).hexdigest()}
    return dict(db=db,scope=scope,checkpoint=c,checkpoint_evidence=sign(directory,"issuer",s.checkpoint_bytes(c)),checkpoint_keys={"issuer":keys["issuer"]},checkpoint_active=["issuer"],anchor=a,anchor_evidence=sign(directory,"authority",s.anchor_bytes(a)),anchor_keys={"authority":keys["authority"]},anchor_active=["authority"],expected_epoch=epoch)

def rows(db):
    c=sqlite3.connect(db)
    try:
        assert c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
        return c.execute("SELECT scope,epoch,fingerprint FROM latest ORDER BY scope").fetchall()
    finally:c.close()

def worker(arg):return s.submit(**arg)

def run():
    with tempfile.TemporaryDirectory(prefix="security140-") as d:
        db=str(Path(d)/"register.sqlite3");keys=setup(d)
        one=args(d,db,keys,1)
        assert s.submit(**one)
        assert not s.submit(**one)
        two=args(d,db,keys,2)
        before=rows(db)
        cases=[
            {**two,"checkpoint":{**two["checkpoint"],"digest":"f"*64}},
            {**two,"anchor":{**two["anchor"],"epoch":3}},
            {**two,"checkpoint_evidence":sign(d,"attacker",s.checkpoint_bytes(two["checkpoint"]))},
            {**two,"anchor_evidence":sign(d,"attacker",s.anchor_bytes(two["anchor"]))},
            {**two,"anchor_revoked":("authority",)},
            {**two,"checkpoint_active":[]},
            {**two,"expected_epoch":3},
            {**two,"scope":"game:999"},
        ]
        for case in cases:assert not s.submit(**case),"adversarial request accepted"
        assert rows(db)==before,"rejected requests mutated register"
        with mp.Pool(4) as pool:results=pool.map(worker,[two]*8)
        assert sum(results)==1,"only one concurrent signed update can commit"
        assert rows(db)[0][1]==2
        three=args(d,db,keys,3)
        crash=mp.Process(target=s.submit,kwargs={**three,"crash":True})
        crash.start();crash.join(20)
        assert crash.exitcode==19
        assert rows(db)[0][1]==2,"crashed transaction must roll back"
        assert s.submit(**three),"retry must succeed"
        assert not s.submit(**one),"old signed state must be rejected"
        assert not s.submit(**args(d,db,keys,5)),"epoch skip must fail"
        assert rows(db)[0][1]==3
        print("SECURITY-140 signature-gated transaction owner adversarial, concurrency and crash PASS")

if __name__=="__main__":run()
