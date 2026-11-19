#!/usr/bin/env python3
"""SECURITY-151 offline bounded admission with accept-time deadline."""
import importlib.util
from pathlib import Path
import queue
import threading
import time

spec=importlib.util.spec_from_file_location("s149",Path(__file__).with_name("security149-integrated-socket.py"))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)

class Server(base.Server):
    """Queue carries accepted monotonic timestamp; no deadline reset in worker."""
    def __init__(self,listener,db,trust,allowed_uids,workers=base.pool.MAX_WORKERS,pending=base.pool.MAX_QUEUE,lifetime=base.MAX_LIFETIME,clock=time.monotonic):
        super().__init__(listener,db,trust,allowed_uids,workers=workers,pending=pending)
        if not 0<lifetime<=base.MAX_LIFETIME:raise ValueError("invalid lifetime")
        self.lifetime=lifetime;self.clock=clock
        self.stats={"accepted":0,"overflow":0,"expired":0,"processed":0}
        self._stats_lock=threading.Lock()
    def _count(self,key):
        with self._stats_lock:self.stats[key]+=1
    def _worker(self):
        while True:
            item=self.pending.get()
            try:
                if item is None:return
                conn,accepted=item
                if self.clock()>=accepted+self.lifetime:
                    conn.close()
                    self._count("expired")
                    continue
                base.handle(conn,self.db,self.trust,self.allowed_uids,self.gate,
                            lifetime=self.lifetime,clock=self.clock,accepted_at=accepted)
                self._count("processed")
            finally:self.pending.task_done()
    def serve(self,accept_count):
        for thread in self.threads:thread.start()
        self.listener.settimeout(2)
        try:
            for _ in range(accept_count):
                conn,_=self.listener.accept()
                accepted=self.clock()
                self._count("accepted")
                try:self.pending.put_nowait((conn,accepted))
                except queue.Full:
                    self._count("overflow")
                    conn.close()
            self.pending.join()
        finally:
            for _ in self.threads:self.pending.put(None)
            for thread in self.threads:thread.join(3)
