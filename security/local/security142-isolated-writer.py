#!/usr/bin/env python3
"""SECURITY-142 offline Unix socket writer. No production use."""
import importlib.util
import json
import os
from pathlib import Path
import socket
import stat

spec=importlib.util.spec_from_file_location("s140",Path(__file__).with_name("security140-transaction-owner.py"))
owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
MAX_REQUEST=65536

def serve_once(listener,db,trust):
    conn,_=listener.accept()
    with conn:
        conn.settimeout(5)
        data=bytearray()
        while len(data)<=MAX_REQUEST:
            chunk=conn.recv(min(4096,MAX_REQUEST+1-len(data)))
            if not chunk:break
            data.extend(chunk)
            if b"\n" in data:break
        success=False
        try:
            if len(data)>MAX_REQUEST or not data.endswith(b"\n") or data.count(b"\n")!=1:raise ValueError("framing")
            request=json.loads(data)
            if type(request) is not dict or set(request)!={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch"}:raise ValueError("fields")
            # Trust material and DB path are owned by the server, never supplied by a client.
            success=owner.submit(db=db,scope=request["scope"],checkpoint=request["checkpoint"],checkpoint_evidence=request["checkpoint_evidence"],checkpoint_keys=trust["checkpoint_keys"],checkpoint_active=trust["checkpoint_active"],checkpoint_revoked=trust.get("checkpoint_revoked",[]),anchor=request["anchor"],anchor_evidence=request["anchor_evidence"],anchor_keys=trust["anchor_keys"],anchor_active=trust["anchor_active"],anchor_revoked=trust.get("anchor_revoked",[]),expected_epoch=request["expected_epoch"])
        except (ValueError,TypeError,KeyError,UnicodeError,json.JSONDecodeError):pass
        conn.sendall((json.dumps({"accepted":success})+"\n").encode())
        return success

def listener(path):
    path=Path(path)
    if path.exists():raise FileExistsError("refuse to replace existing socket or symlink")
    if not path.parent.is_dir() or path.parent.is_symlink():raise ValueError("socket parent")
    if stat.S_IMODE(path.parent.stat().st_mode)&0o077:raise PermissionError("socket directory must be private")
    sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
    old=os.umask(0o077)
    try:
        sock.bind(str(path))
        os.chmod(path,0o600)
        sock.listen(4)
    finally:os.umask(old)
    return sock

def request(path,payload):
    with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as s:
        s.settimeout(5);s.connect(str(path))
        s.sendall(json.dumps(payload,separators=(",",":")).encode()+b"\n")
        s.shutdown(socket.SHUT_WR)
        return json.loads(s.makefile("rb").readline())["accepted"]
