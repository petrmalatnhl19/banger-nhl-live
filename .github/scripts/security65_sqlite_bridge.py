#!/usr/bin/env python3
"""Offline SQLite persistence bridge for SECURITY-65 synthetic signed fixtures."""
import json
import os
import sqlite3
import sys

op, database, payload_path, extra = sys.argv[1:]
db = sqlite3.connect(database, isolation_level=None, timeout=10)
db.execute("PRAGMA journal_mode=WAL")
db.execute("PRAGMA synchronous=FULL")
db.execute("CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)")
db.execute("CREATE TABLE IF NOT EXISTS audit (sequence INTEGER PRIMARY KEY, head_hash TEXT NOT NULL)")


def load():
    return json.load(open(payload_path, encoding="utf8"))


def stored():
    row = db.execute("SELECT data FROM snapshot WHERE id=1").fetchone()
    if not row:
        raise RuntimeError("missing snapshot")
    return json.loads(row[0])


def save(value):
    db.execute("INSERT INTO snapshot (id,data) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", (json.dumps(value, sort_keys=True),))
    db.execute("INSERT INTO audit (sequence,head_hash) VALUES (?,?)", (value["anchor"]["sequence"], value["anchor"]["headHash"]))


if op == "init":
    db.execute("BEGIN IMMEDIATE")
    save(load())
    db.commit()
elif op == "read":
    value = stored()
    row = db.execute("SELECT MAX(sequence) FROM audit").fetchone()
    if row[0] != value["anchor"]["sequence"]:
        raise RuntimeError("snapshot and audit out of sync")
    print(json.dumps(value))
elif op == "crash":
    db.execute("BEGIN IMMEDIATE")
    save(load())
    os._exit(77)
elif op == "commit":
    value = load()
    old = stored()
    if value == old:
        print(json.dumps({"duplicate": True}))
    else:
        if value["anchor"]["sequence"] != old["anchor"]["sequence"] + 1:
            raise RuntimeError("nonsequential checkpoint")
        if value["history"][:len(old["history"])] != old["history"]:
            raise RuntimeError("history rewrite")
        db.execute("BEGIN IMMEDIATE")
        save(value)
        db.commit()
        print(json.dumps({"duplicate": False}))
elif op == "tamper":
    value = stored()
    value["archive"]["records"][0]["away"] = 999
    db.execute("UPDATE snapshot SET data=? WHERE id=1", (json.dumps(value),))
else:
    raise ValueError(op)
