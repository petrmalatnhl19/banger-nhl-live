#!/usr/bin/env python3
"""SECURITY-145 bounded offline socket admission; not a production daemon."""
import collections
import json
import socket
import threading
import time
from pathlib import Path
import importlib.util

spec=importlib.util.spec_from_file_location("peer144",Path(__file__).with_name("security144-peercred-writer.py"))
peer=importlib.util.module_from_spec(spec);spec.loader.exec_module(peer)
MAX_BYTES=16384
READ_TIMEOUT=0.4
MAX_INFLIGHT=2
WINDOW=1.0
MAX_PER_UID=3

class Gate:
    def __init__(self,clock=time.monotonic):
        self.clock=clock
        self.lock=threading.Lock()
        self.inflight=0
        self.hits=collections.defaultdict(collections.deque)
    def acquire(self,uid):
        with self.lock:
            now=self.clock()
            hits=self.hits[uid]
            while hits and now-hits[0]>=WINDOW:hits.popleft()
            if self.inflight>=MAX_INFLIGHT or len(hits)>=MAX_PER_UID:return False
            self.inflight+=1
            hits.append(now)
            return True
    def release(self):
        with self.lock:
            self.inflight-=1

def handle(conn,db,trust,allowed_uids,gate):
    """Reject unauthorized/over-limit peers before parsing. Reuse SECURITY-140 signed owner."""
    with conn:
        conn.settimeout(READ_TIMEOUT)
        acquired=False
        try:
            _,uid,_=peer.peer_identity(conn)
            if uid not in allowed_uids or not gate.acquire(uid):return False
            acquired=True
            data=bytearray()
            while len(data)<=MAX_BYTES:
                chunk=conn.recv(min(4096,MAX_BYTES+1-len(data)))
                if not chunk:break
                data.extend(chunk)
                if b"\n" in data:break
            if len(data)>MAX_BYTES or not data.endswith(b"\n") or data.count(b"\n")!=1:return False
            request=json.loads(data)
            if type(request) is not dict or set(request)!={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch"}:return False
            import importlib.util
            spec=importlib.util.spec_from_file_location("owner140",Path(__file__).with_name("security140-transaction-owner.py"))
            owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
            ok=owner.submit(db=db,scope=request["scope"],checkpoint=request["checkpoint"],checkpoint_evidence=request["checkpoint_evidence"],checkpoint_keys=trust["checkpoint_keys"],checkpoint_active=trust["checkpoint_active"],checkpoint_revoked=trust.get("checkpoint_revoked",[]),anchor=request["anchor"],anchor_evidence=request["anchor_evidence"],anchor_keys=trust["anchor_keys"],anchor_active=trust["anchor_active"],anchor_revoked=trust.get("anchor_revoked",[]),expected_epoch=request["expected_epoch"])
            conn.sendall((json.dumps({"accepted":bool(ok)})+"\n").encode())
            return bool(ok)
        except (OSError,ValueError,KeyError,TypeError,UnicodeError,json.JSONDecodeError,socket.timeout):
            return False
        finally:
            if acquired:gate.release()

def serve_once(listener,db,trust,allowed_uids,gate):
    if type(allowed_uids) not in (set,frozenset) or not allowed_uids or any(type(x) is not int or x<0 for x in allowed_uids):
        raise ValueError("explicit UID allowlist required")
    conn,_=listener.accept()
    return handle(conn,db,trust,allowed_uids,gate)
