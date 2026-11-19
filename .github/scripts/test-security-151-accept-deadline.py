#!/usr/bin/env python3
"""SECURITY-151 accept-to-completion deadline and queue saturation regression."""
import importlib.util
import os
from pathlib import Path
import socket
import tempfile
import threading
import time

def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod);return mod
s=load("s151","security/local/security151-accept-deadline.py")

def run():
    with tempfile.TemporaryDirectory(prefix="security151-") as directory:
        # Explicitly expired before worker: no signature or database operation may start.
        left,right=socket.socketpair()
        gate=s.base.pool.base.Gate()
        result=s.base.handle(left,str(Path(directory)/"never.sqlite"),{}, {os.getuid()},gate,
                             lifetime=0.3,accepted_at=time.monotonic()-1)
        right.close()
        assert result=="unknown"
        assert not (Path(directory)/"never.sqlite").exists()
        # One worker, one pending slot, four accepted clients: overflow must reject.
        address=str(Path(directory)/"socket")
        listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        listener.bind(address);listener.listen(8)
        server=s.Server(listener,str(Path(directory)/"ledger.sqlite"),{}, {os.getuid()},
                        workers=1,pending=1,lifetime=0.4)
        thread=threading.Thread(target=lambda:server.serve(4))
        thread.start()
        clients=[]
        for _ in range(4):
            conn=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
            conn.connect(address)
            conn.sendall(b"x")
            clients.append(conn)
        thread.join(5)
        assert not thread.is_alive(),"server failed to drain queue"
        assert server.stats["accepted"]==4,server.stats
        assert server.stats["overflow"]>=1,server.stats
        assert server.stats["processed"]+server.stats["expired"]+server.stats["overflow"]==4,server.stats
        assert not (Path(directory)/"ledger.sqlite").exists(),"malformed/expired requests reached SQLite"
        for conn in clients:conn.close()
        listener.close()
        # Same admission bounds and original worker limits must remain enforced.
        listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        try:
            for kw in ({"workers":3},{"pending":3},{"lifetime":3}):
                try:s.Server(listener,"db",{}, {os.getuid()},**kw)
                except ValueError:pass
                else:raise AssertionError(f"invalid bounds accepted: {kw}")
        finally:listener.close()
    print("SECURITY-151 accept deadline, saturated queue, overflow, no SQLite mutation PASS")

if __name__=="__main__":run()
