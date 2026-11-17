#!/usr/bin/env python3
"""SECURITY-148 offline idempotent signed SQLite transaction owner."""
import hashlib
import importlib.util
import json
import re
import sqlite3
from pathlib import Path

spec=importlib.util.spec_from_file_location("owner140",Path(__file__).with_name("security140-transaction-owner.py"))
owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
SCHEMA="""CREATE TABLE IF NOT EXISTS latest (
 scope TEXT PRIMARY KEY, epoch INTEGER NOT NULL CHECK(epoch>0),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64));
CREATE TABLE IF NOT EXISTS receipts (
 request_id TEXT PRIMARY KEY, digest TEXT NOT NULL CHECK(length(digest)=64),
 scope TEXT NOT NULL, epoch INTEGER NOT NULL, outcome TEXT NOT NULL CHECK(outcome='committed'));"""

def verify(request,trust):
    if type(request) is not dict or set(request)!={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch","request_id"}:return None
    rid=request["request_id"];scope=request["scope"];epoch=request["expected_epoch"]
    if type(rid) is not str or not re.fullmatch(r"[a-f0-9]{32,64}",rid):return None
    if type(scope) is not str or not re.fullmatch(r"game:[0-9]{1,12}",scope) or type(epoch) is not int or not 0<epoch<2**53:return None
    cp=owner.checkpoint_bytes(request["checkpoint"])
    anchor=owner.anchor_bytes(request["anchor"])
    if scope not in request["checkpoint"]["heads"] or request["anchor"]["epoch"]!=epoch or request["anchor"]["checkpoint_digest"]!=hashlib.sha256(cp).hexdigest():return None
    if not owner.signature_valid(cp,request["checkpoint_evidence"],trust["checkpoint_keys"],trust["checkpoint_active"],trust.get("checkpoint_revoked",[])):return None
    if not owner.signature_valid(anchor,request["anchor_evidence"],trust["anchor_keys"],trust["anchor_active"],trust.get("anchor_revoked",[])):return None
    # Receipt is bound to the entire signed envelope, not just client-selected request_id.
    digest=hashlib.sha256(json.dumps(request,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()).hexdigest()
    return rid,digest,scope,epoch,request["anchor"]["checkpoint_digest"]

def submit(db,trust,request,after_commit=None):
    """Return committed/replayed/rejected; optional fault injection after durable commit."""
    try:
        verified=verify(request,trust)
        if verified is None:return "rejected"
        rid,digest,scope,epoch,fingerprint=verified
        with sqlite3.connect(db,timeout=1,isolation_level=None) as conn:
            conn.executescript(SCHEMA)
            conn.execute("BEGIN IMMEDIATE")
            existing=conn.execute("SELECT digest FROM receipts WHERE request_id=?",(rid,)).fetchone()
            if existing:
                conn.rollback()
                return "replayed" if existing[0]==digest else "rejected"
            row=conn.execute("SELECT epoch FROM latest WHERE scope=?",(scope,)).fetchone()
            if (row is None and epoch!=1) or (row is not None and epoch!=row[0]+1):
                conn.rollback();return "rejected"
            conn.execute("INSERT INTO latest(scope,epoch,fingerprint) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET epoch=excluded.epoch,fingerprint=excluded.fingerprint",(scope,epoch,fingerprint))
            conn.execute("INSERT INTO receipts(request_id,digest,scope,epoch,outcome) VALUES(?,?,?,?,'committed')",(rid,digest,scope,epoch))
            conn.commit()
        if after_commit:after_commit()
        return "committed"
    except (sqlite3.Error,ValueError,TypeError,KeyError,OSError,UnicodeError):
        return "rejected"

def reconcile(db,trust,request):
    """Authenticated status query: re-verify original signed envelope before lookup."""
    try:
        verified=verify(request,trust)
        if verified is None:return "rejected"
        rid,digest,_,_,_=verified
        with sqlite3.connect(db,timeout=1) as conn:
            row=conn.execute("SELECT digest,outcome FROM receipts WHERE request_id=?",(rid,)).fetchone()
        if row is None:return "unknown"
        return row[1] if row[0]==digest else "rejected"
    except (sqlite3.Error,ValueError,TypeError,KeyError,OSError,UnicodeError):
        return "unknown"
