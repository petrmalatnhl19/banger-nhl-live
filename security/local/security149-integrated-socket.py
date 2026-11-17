#!/usr/bin/env python3
"""SECURITY-149 offline socket-to-receipt integration; no production use."""
import importlib.util
import json
import signal
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent
def load(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module
pool=load("s146","security146-deadline-workers.py")
MAX_LIFETIME=2.0
FIELDS={"operation","request"}
REQUEST_FIELDS={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch","request_id"}

def child(db,trust,operation,request,delay=0):
    owner=load("s148","security148-idempotent-owner.py")
    if delay:time.sleep(delay)  # test-only fault injection
    return owner.submit(db,trust,request) if operation=="submit" else owner.reconcile(db,trust,request)

def bounded(db,trust,operation,request,remaining,delay=0):
    """Fresh interpreter avoids multiprocessing dynamic-module pickle issues."""
    if remaining<=0:return "unknown"
    proc=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),"--child"],
                          stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,
                          start_new_session=True)
    payload=json.dumps({"db":db,"trust":trust,"operation":operation,"request":request,"delay":delay}).encode()
    try:
        output,_=proc.communicate(payload,timeout=min(remaining,MAX_LIFETIME))
        if proc.returncode!=0:return "unknown"
        value=json.loads(output)
        return value if value in ("committed","replayed","rejected","unknown") else "unknown"
    except (subprocess.TimeoutExpired,OSError,ValueError):
        try:os.killpg(proc.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        try:proc.communicate(timeout=0.5)
        except subprocess.TimeoutExpired:pass
        return "unknown"
    finally:
        if proc.poll() is None:
            try:os.killpg(proc.pid,signal.SIGKILL)
            except ProcessLookupError:pass
            try:proc.communicate(timeout=0.5)
            except subprocess.TimeoutExpired:pass

def handle(conn,db,trust,allowed_uids,gate,lifetime=MAX_LIFETIME,delay=0,clock=time.monotonic):
    """Bound receive, signed child operation and response by one deadline."""
    with conn:
        admitted=False
        try:
            _,uid,_=pool.base.peer.peer_identity(conn)
            if uid not in allowed_uids or not gate.acquire(uid):return "rejected"
            admitted=True
            deadline=clock()+lifetime
            data=bytearray()
            while True:
                remaining=deadline-clock()
                if remaining<=0:return "unknown"
                conn.settimeout(min(pool.base.READ_TIMEOUT,remaining))
                chunk=conn.recv(min(4096,pool.base.MAX_BYTES+1-len(data)))
                if not chunk:break
                data.extend(chunk)
                if len(data)>pool.base.MAX_BYTES:return "rejected"
                if b"\n" in data:break
            if clock()>=deadline or not data.endswith(b"\n") or data.count(b"\n")!=1:return "rejected"
            message=json.loads(data)
            if type(message) is not dict or set(message)!=FIELDS or message["operation"] not in ("submit","reconcile") or type(message["request"]) is not dict or set(message["request"])!=REQUEST_FIELDS:return "rejected"
            remaining=deadline-clock()
            result=bounded(db,trust,message["operation"],message["request"],remaining,delay)
            if deadline-clock()<=0:return "unknown"
            try:
                conn.settimeout(max(0.001,deadline-clock()))
                conn.sendall((json.dumps({"status":result})+"\n").encode())
            except OSError:pass
            return result
        except (OSError,ValueError,TypeError,KeyError,UnicodeError):
            return "rejected"
        finally:
            if admitted:gate.release()

class Server(pool.Server):
    """Reuse SECURITY-146 bounded queue and worker limits with SECURITY-149 handler."""
    def _worker(self):
        while True:
            conn=self.pending.get()
            try:
                if conn is None:return
                handle(conn,self.db,self.trust,self.allowed_uids,self.gate)
            finally:self.pending.task_done()

if __name__=="__main__" and sys.argv[1:]==["--child"]:
    try:
        payload=json.loads(sys.stdin.buffer.read(pool.base.MAX_BYTES*2))
        if type(payload) is not dict or set(payload)!={"db","trust","operation","request","delay"} or payload["operation"] not in ("submit","reconcile"):raise ValueError("invalid payload")
        print(json.dumps(child(**payload)),flush=True)
    except (ValueError,TypeError,KeyError,OSError):
        sys.exit(1)
