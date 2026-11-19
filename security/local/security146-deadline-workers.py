#!/usr/bin/env python3
"""SECURITY-146 bounded worker pool and absolute receive deadline; offline only."""
import importlib.util
import json
from pathlib import Path
import queue
import socket
import threading
import time

spec=importlib.util.spec_from_file_location("s145",Path(__file__).with_name("security145-bounded-writer.py"))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)
MAX_WORKERS=2
MAX_QUEUE=2
TOTAL_READ_SECONDS=0.8

def handle(conn,db,trust,allowed_uids,gate,deadline_seconds=TOTAL_READ_SECONDS,clock=time.monotonic):
    """Absolute monotonic deadline for the entire framed receive, including trickle."""
    with conn:
        admitted=False
        try:
            _,uid,_=base.peer.peer_identity(conn)
            if uid not in allowed_uids or not gate.acquire(uid):return False
            admitted=True
            deadline=clock()+deadline_seconds
            data=bytearray()
            while True:
                remaining=deadline-clock()
                if remaining<=0:return False
                conn.settimeout(min(base.READ_TIMEOUT,remaining))
                chunk=conn.recv(min(4096,base.MAX_BYTES+1-len(data)))
                if not chunk:break
                data.extend(chunk)
                if len(data)>base.MAX_BYTES:return False
                if b"\n" in data:break
            if clock()>deadline or not data.endswith(b"\n") or data.count(b"\n")!=1:return False
            request=json.loads(data)
            if type(request) is not dict or set(request)!={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch"}:return False
            spec=importlib.util.spec_from_file_location("owner140",Path(__file__).with_name("security140-transaction-owner.py"))
            owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
            ok=owner.submit(db=db,scope=request["scope"],checkpoint=request["checkpoint"],checkpoint_evidence=request["checkpoint_evidence"],checkpoint_keys=trust["checkpoint_keys"],checkpoint_active=trust["checkpoint_active"],checkpoint_revoked=trust.get("checkpoint_revoked",[]),anchor=request["anchor"],anchor_evidence=request["anchor_evidence"],anchor_keys=trust["anchor_keys"],anchor_active=trust["anchor_active"],anchor_revoked=trust.get("anchor_revoked",[]),expected_epoch=request["expected_epoch"])
            conn.sendall((json.dumps({"accepted":bool(ok)})+"\n").encode())
            return bool(ok)
        except (OSError,ValueError,KeyError,TypeError,UnicodeError,json.JSONDecodeError):
            return False
        finally:
            if admitted:gate.release()

class Server:
    """Fixed workers, bounded pending queue, reject overflow. No production use."""
    def __init__(self,listener,db,trust,allowed_uids,workers=MAX_WORKERS,pending=MAX_QUEUE):
        if type(allowed_uids) not in (set,frozenset) or not allowed_uids or any(type(x) is not int or x<0 for x in allowed_uids):
            raise ValueError("explicit UID allowlist required")
        if not 1<=workers<=MAX_WORKERS or not 1<=pending<=MAX_QUEUE:raise ValueError("invalid worker limits")
        self.listener=listener;self.db=db;self.trust=trust;self.allowed_uids=allowed_uids
        self.gate=base.Gate();self.pending=queue.Queue(maxsize=pending)
        self.threads=[threading.Thread(target=self._worker,daemon=True) for _ in range(workers)]
        self.stop=threading.Event()
    def _worker(self):
        while True:
            conn=self.pending.get()
            try:
                if conn is None:return
                handle(conn,self.db,self.trust,self.allowed_uids,self.gate)
            finally:self.pending.task_done()
    def serve(self,accept_count):
        for t in self.threads:t.start()
        self.listener.settimeout(1)
        try:
            for _ in range(accept_count):
                conn,_=self.listener.accept()
                try:self.pending.put_nowait(conn)
                except queue.Full:conn.close()
            self.pending.join()
        finally:
            for _ in self.threads:self.pending.put(None)
            for t in self.threads:t.join(3)
