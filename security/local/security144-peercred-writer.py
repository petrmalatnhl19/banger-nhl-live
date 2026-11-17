#!/usr/bin/env python3
"""SECURITY-144 Linux-only peer credential gate; offline prototype, not production."""
import json
import socket
import struct
import sys

def peer_identity(conn):
    if not sys.platform.startswith("linux") or not hasattr(socket,"SO_PEERCRED"):
        raise RuntimeError("Linux SO_PEERCRED required; fail closed")
    raw=conn.getsockopt(socket.SOL_SOCKET,socket.SO_PEERCRED,struct.calcsize("3i"))
    pid,uid,gid=struct.unpack("3i",raw)
    if pid<=0 or uid<0 or gid<0:raise ValueError("invalid peer credentials")
    return pid,uid,gid

def serve_once(listener,db,trust,allowed_uids):
    """Authenticate the kernel-reported UID before parsing or verifying a signed request."""
    if not isinstance(allowed_uids,(set,frozenset)) or not allowed_uids or any(type(x) is not int or x<0 for x in allowed_uids):
        raise ValueError("explicit UID allowlist required")
    conn,_=listener.accept()
    with conn:
        conn.settimeout(5)
        try:
            _,uid,_=peer_identity(conn)
        except (OSError,ValueError,RuntimeError):
            conn.sendall(b'{"accepted":false}\n');return False
        if uid not in allowed_uids:
            conn.sendall(b'{"accepted":false}\n');return False
        # Keep the verified socket: never accept a second connection between
        # authorization and parsing. This is the same authenticated peer.
        import importlib.util
        from pathlib import Path
        spec=importlib.util.spec_from_file_location("s140",Path(__file__).with_name("security140-transaction-owner.py"))
        owner=importlib.util.module_from_spec(spec);spec.loader.exec_module(owner)
        data=bytearray()
        while len(data)<=65536:
            chunk=conn.recv(min(4096,65537-len(data)))
            if not chunk:break
            data.extend(chunk)
            if b"\n" in data:break
        ok=False
        try:
            if len(data)>65536 or not data.endswith(b"\n") or data.count(b"\n")!=1:raise ValueError("framing")
            request=json.loads(data)
            if type(request) is not dict or set(request)!={"scope","checkpoint","checkpoint_evidence","anchor","anchor_evidence","expected_epoch"}:raise ValueError("fields")
            ok=owner.submit(db=db,scope=request["scope"],checkpoint=request["checkpoint"],checkpoint_evidence=request["checkpoint_evidence"],checkpoint_keys=trust["checkpoint_keys"],checkpoint_active=trust["checkpoint_active"],checkpoint_revoked=trust.get("checkpoint_revoked",[]),anchor=request["anchor"],anchor_evidence=request["anchor_evidence"],anchor_keys=trust["anchor_keys"],anchor_active=trust["anchor_active"],anchor_revoked=trust.get("anchor_revoked",[]),expected_epoch=request["expected_epoch"])
        except (ValueError,TypeError,KeyError,UnicodeError,json.JSONDecodeError):pass
        conn.sendall((json.dumps({"accepted":ok})+"\n").encode())
        return ok
