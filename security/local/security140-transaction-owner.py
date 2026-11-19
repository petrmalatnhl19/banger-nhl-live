#!/usr/bin/env python3
"""SECURITY-140: offline transaction owner validates Ed25519 before SQLite write.
OpenSSL is a subprocess used solely for cryptographic verification; no unauthenticated
register write endpoint is exported by this module.
"""
import base64
import hashlib
import json
import re
import sqlite3
import subprocess
import tempfile
from pathlib import Path

PREFIX_CHECKPOINT=b"BANGER-SQLITE-CHECKPOINT-V1\n"
PREFIX_ANCHOR=b"BANGER-CHECKPOINT-ANCHOR-V1\n"
SCHEMA="""CREATE TABLE IF NOT EXISTS latest (
 scope TEXT PRIMARY KEY, epoch INTEGER NOT NULL CHECK(epoch>0),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64)
);"""

def checkpoint_bytes(c):
    if not isinstance(c,dict) or set(c)!={"version","digest","heads"} or c["version"]!=1 or type(c["digest"]) is not str or not re.fullmatch("[a-f0-9]{64}",c["digest"]):raise ValueError("checkpoint")
    heads=c["heads"]
    if type(heads) is not dict or not 1<=len(heads)<=1000 or any(not isinstance(k,str) or not re.fullmatch(r"game:[0-9]{1,12}",k) or type(v) is not int or not 0<v<2**53 for k,v in heads.items()):raise ValueError("heads")
    return PREFIX_CHECKPOINT+json.dumps({"version":1,"digest":c["digest"],"heads":dict(sorted(heads.items()))},separators=(",",":"),ensure_ascii=True).encode()

def anchor_bytes(a):
    if type(a) is not dict or set(a)!={"version","epoch","checkpoint_digest"} or a["version"]!=1 or type(a["epoch"]) is not int or not 0<a["epoch"]<2**53 or type(a["checkpoint_digest"]) is not str or not re.fullmatch("[a-f0-9]{64}",a["checkpoint_digest"]):raise ValueError("anchor")
    return PREFIX_ANCHOR+json.dumps({"version":1,"epoch":a["epoch"],"checkpoint_digest":a["checkpoint_digest"]},separators=(",",":"),ensure_ascii=True).encode()

def signature_valid(payload,evidence,keys,active,revoked):
    if type(evidence) is not dict or evidence.get("algorithm")!="Ed25519" or type(evidence.get("key_id")) is not str or evidence["key_id"] not in active or evidence["key_id"] in revoked or evidence["key_id"] not in keys:return False
    try:
        signature=evidence["signature"]
        if type(signature) is not str or not re.fullmatch(r"[A-Za-z0-9+/]{86}==",signature):return False
        raw=base64.b64decode(signature,validate=True)
        if len(raw)!=64 or base64.b64encode(raw).decode()!=signature:return False
        with tempfile.TemporaryDirectory(prefix="security140-verify-") as d:
            p=Path(d);(p/"key.pem").write_text(keys[evidence["key_id"]]);(p/"payload").write_bytes(payload);(p/"signature").write_bytes(raw)
            r=subprocess.run(["openssl","pkeyutl","-verify","-pubin","-inkey",str(p/"key.pem"),"-rawin","-in",str(p/"payload"),"-sigfile",str(p/"signature")],capture_output=True,timeout=10)
            return r.returncode==0
    except (ValueError,KeyError,TypeError,OSError,subprocess.TimeoutExpired):return False

def submit(db,scope,checkpoint,checkpoint_evidence,checkpoint_keys,checkpoint_active,anchor,anchor_evidence,anchor_keys,anchor_active,expected_epoch,anchor_revoked=(),checkpoint_revoked=(),crash=False):
    """Single trusted transaction owner. All validation is done before BEGIN IMMEDIATE.
    This prototype has no callable unauthenticated database mutation API.
    """
    try:
        if type(scope) is not str or not re.fullmatch(r"game:[0-9]{1,12}",scope) or type(expected_epoch) is not int or expected_epoch<=0:return False
        cp_bytes=checkpoint_bytes(checkpoint)
        a_bytes=anchor_bytes(anchor)
        if scope not in checkpoint["heads"] or anchor["epoch"]!=expected_epoch or anchor["checkpoint_digest"]!=hashlib.sha256(cp_bytes).hexdigest():return False
        if not signature_valid(cp_bytes,checkpoint_evidence,checkpoint_keys,checkpoint_active,checkpoint_revoked):return False
        if not signature_valid(a_bytes,anchor_evidence,anchor_keys,anchor_active,anchor_revoked):return False
        c=sqlite3.connect(db,timeout=15,isolation_level=None)
        try:
            c.execute("PRAGMA busy_timeout=15000")
            c.executescript(SCHEMA)
            c.execute("BEGIN IMMEDIATE")
            row=c.execute("SELECT epoch FROM latest WHERE scope=?",(scope,)).fetchone()
            if (row is None and expected_epoch!=1) or (row is not None and expected_epoch!=row[0]+1):
                c.rollback();return False
            c.execute("INSERT INTO latest(scope,epoch,fingerprint) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET epoch=excluded.epoch,fingerprint=excluded.fingerprint",(scope,expected_epoch,anchor["checkpoint_digest"]))
            if crash:
                import os
                os._exit(19)
            c.commit();return True
        finally:c.close()
    except (sqlite3.DatabaseError,ValueError,KeyError,TypeError,OSError,subprocess.TimeoutExpired):return False
