#!/usr/bin/env python3
"""SECURITY-138: disposable SQLite latest-anchor register concurrency/crash recovery."""
import multiprocessing as mp
import os
import sqlite3
import tempfile

SCHEMA="""CREATE TABLE IF NOT EXISTS latest (
 scope TEXT PRIMARY KEY, epoch INTEGER NOT NULL CHECK(epoch>0),
 fingerprint TEXT NOT NULL CHECK(length(fingerprint)=64)
);"""
SCOPE="game:2026020335"

def update(db,scope,epoch,fingerprint,crash=False):
 try:
  c=sqlite3.connect(db,timeout=15,isolation_level=None)
  c.execute("PRAGMA busy_timeout=15000")
  c.executescript(SCHEMA)
  c.execute("BEGIN IMMEDIATE")
  row=c.execute("SELECT epoch,fingerprint FROM latest WHERE scope=?",(scope,)).fetchone()
  if row is not None and (epoch<=row[0] or epoch!=row[0]+1):
   c.rollback()
   return False
  if row is None and epoch!=1:
   c.rollback()
   return False
  c.execute("INSERT INTO latest(scope,epoch,fingerprint) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET epoch=excluded.epoch,fingerprint=excluded.fingerprint",(scope,epoch,fingerprint))
  if crash:os._exit(19)
  c.commit()
  return True
 except sqlite3.DatabaseError:
  return False
 finally:
  if "c" in locals():c.close()

def worker(args):
 db,scope,epoch,fingerprint=args
 return update(db,scope,epoch,fingerprint)

def state(db):
 c=sqlite3.connect(db)
 try:
  assert c.execute("PRAGMA integrity_check").fetchone()[0]=="ok"
  return c.execute("SELECT scope,epoch,fingerprint FROM latest ORDER BY scope").fetchall()
 finally:c.close()

def run():
 with tempfile.TemporaryDirectory(prefix="security138-") as directory:
  db=os.path.join(directory,"anchors.sqlite3")
  assert update(db,SCOPE,1,"a"*64)
  attempts=[(db,SCOPE,2,format(i,"064x")) for i in range(1,13)]
  with mp.Pool(processes=6) as pool:results=pool.map(worker,attempts)
  assert sum(results)==1,"exactly one concurrent next epoch must win"
  current=state(db)
  assert current[0][1]==2
  assert not update(db,SCOPE,2,"b"*64),"duplicate epoch denied"
  assert not update(db,SCOPE,1,"a"*64),"rollback denied"
  assert not update(db,SCOPE,4,"c"*64),"skipped epoch denied"
  assert state(db)==current
  child=mp.Process(target=update,args=(db,SCOPE,3,"c"*64,True))
  child.start();child.join(20)
  assert child.exitcode==19,"crash fixture must terminate mid-transaction"
  assert state(db)==current,"uncommitted epoch must roll back"
  assert update(db,SCOPE,3,"c"*64),"retry after crash must succeed"
  assert update(db,"game:123",1,"d"*64),"independent scope allowed"
  assert len(state(db))==2
  assert not update(db,SCOPE,3,"e"*64)
  assert state(db)[1][1]==3
  print("SECURITY-138 concurrent anchor updates, monotonic epoch and crash recovery PASS")

if __name__=="__main__":run()
