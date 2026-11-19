#!/usr/bin/env python3
"""SECURITY-147 offline subprocess-bounded signed transaction. Not for production."""
import importlib.util
import json
import multiprocessing as mp
from pathlib import Path
import socket
import time

spec=importlib.util.spec_from_file_location("s146",Path(__file__).with_name("security146-deadline-workers.py"))
previous=importlib.util.module_from_spec(spec);spec.loader.exec_module(previous)
MAX_LIFETIME=2.0
KILL_GRACE=0.5
FIELDS={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch"}

def transaction_worker(send,db,trust,request,delay=0):
    """Child owns signature verification and SQLite connection, never parent thread."""
    try:
        if delay:time.sleep(delay) # offline fault injection only
        spec=importlib.util.spec_from_file_location("owner140",Path(__file__).with_name("security140-transaction-owner.py"))
        owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
        ok=owner.submit(db=db,scope=request["scope"],checkpoint=request["checkpoint"],checkpoint_evidence=request["checkpoint_evidence"],checkpoint_keys=trust["checkpoint_keys"],checkpoint_active=trust["checkpoint_active"],checkpoint_revoked=trust.get("checkpoint_revoked",[]),anchor=request["anchor"],anchor_evidence=request["anchor_evidence"],anchor_keys=trust["anchor_keys"],anchor_active=trust["anchor_active"],anchor_revoked=trust.get("anchor_revoked",[]),expected_epoch=request["expected_epoch"])
        send.send(bool(ok))
    except (OSError,ValueError,TypeError,KeyError,EOFError,BrokenPipeError):
        pass
    finally:send.close()

def bounded_submit(db,trust,request,seconds=MAX_LIFETIME,delay=0):
    if seconds<=0 or seconds>MAX_LIFETIME:raise ValueError("invalid lifetime budget")
    ctx=mp.get_context("spawn")
    recv,send=ctx.Pipe(duplex=False)
    process=ctx.Process(target=transaction_worker,args=(send,db,trust,request,delay))
    process.start();send.close()
    try:
        process.join(seconds)
        if process.is_alive():
            process.terminate()
            process.join(KILL_GRACE)
            if process.is_alive():
                process.kill();process.join(KILL_GRACE)
            return False
        return process.exitcode==0 and recv.poll() and recv.recv() is True
    finally:
        recv.close()
        if process.is_alive():
            process.kill();process.join(KILL_GRACE)
        process.close()

def handle(conn,db,trust,allowed_uids,gate,lifetime=MAX_LIFETIME,clock=time.monotonic):
    """One monotonic deadline from authorized connection through child completion."""
    with conn:
        acquired=False
        try:
            _,uid,_=previous.base.peer.peer_identity(conn)
            if uid not in allowed_uids or not gate.acquire(uid):return False
            acquired=True
            deadline=clock()+lifetime
            data=bytearray()
            while True:
                remaining=deadline-clock()
                if remaining<=0:return False
                conn.settimeout(min(previous.base.READ_TIMEOUT,remaining))
                chunk=conn.recv(min(4096,previous.base.MAX_BYTES+1-len(data)))
                if not chunk:break
                data.extend(chunk)
                if len(data)>previous.base.MAX_BYTES:return False
                if b"\n" in data:break
            if clock()>=deadline or not data.endswith(b"\n") or data.count(b"\n")!=1:return False
            request=json.loads(data)
            if type(request) is not dict or set(request)!=FIELDS:return False
            remaining=deadline-clock()
            if remaining<=0:return False
            ok=bounded_submit(db,trust,request,seconds=min(MAX_LIFETIME,remaining))
            try:
                conn.settimeout(max(0.01,deadline-clock()))
                conn.sendall((json.dumps({"accepted":ok})+"\n").encode())
            except (OSError,socket.timeout):pass
            return ok
        except (OSError,ValueError,TypeError,KeyError,UnicodeError,json.JSONDecodeError):
            return False
        finally:
            if acquired:gate.release()
