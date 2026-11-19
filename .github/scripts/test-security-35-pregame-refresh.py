#!/usr/bin/env python3
"""SECURITY-35: deterministic, offline, append-only pregame refresh prototype.

SQLite in memory only. No Supabase connection, HTTP, credentials or production writes.
"""
import hashlib
import json
import sqlite3
import unittest
from datetime import datetime, timedelta, timezone

UTC = timezone.utc


def iso(dt):
    return dt.astimezone(UTC).isoformat()


def create_db():
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys=ON")
    db.executescript("""
    CREATE TABLE originals(
      game_id INTEGER PRIMARY KEY, generated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE versions(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES originals(game_id),
      cutoff_at TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,
      payload TEXT NOT NULL,
      UNIQUE(game_id,cutoff_at,snapshot_hash)
    );
    """)
    return db


def refresh(db, *, game_id, cutoff, generated, start, status, evidence):
    """Return new version ID, or None if no eligible, pregame evidence.

    This prototype assumes all supplied datetimes are timezone-aware and that
    start is a trustworthy actual puck-drop boundary (not just scheduled time).
    """
    times = [cutoff, generated, start]
    if any(t.tzinfo is None or t.utcoffset() is None for t in times):
        return None
    if status != "scheduled" or not (cutoff <= generated < start and cutoff < start):
        return None
    if db.execute("SELECT 1 FROM originals WHERE game_id=?", (game_id,)).fetchone() is None:
        return None
    accepted = []
    for item in evidence:
        dates = [item["published"], item["verified"], item["ingested"]]
        if any(d.tzinfo is None or d.utcoffset() is None for d in dates):
            continue
        if all(d <= cutoff for d in dates):
            accepted.append({"goalie_id": str(item["goalie_id"]),
                             "published": iso(item["published"]),
                             "verified": iso(item["verified"]),
                             "ingested": iso(item["ingested"])})
    if not accepted:
        return None
    accepted.sort(key=lambda x: (x["goalie_id"], x["published"], x["verified"], x["ingested"]))
    payload = json.dumps(accepted, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(payload.encode()).hexdigest()
    with db:
        db.execute("""INSERT OR IGNORE INTO versions
            (game_id,cutoff_at,generated_at,snapshot_hash,payload)
            VALUES(?,?,?,?,?)""", (game_id, iso(cutoff), iso(generated), digest, payload))
        row = db.execute("""SELECT id FROM versions
            WHERE game_id=? AND cutoff_at=? AND snapshot_hash=?""",
            (game_id, iso(cutoff), digest)).fetchone()
    return row[0]


class PregameRefreshTests(unittest.TestCase):
    def setUp(self):
        self.db = create_db()
        self.now = datetime(2026, 11, 16, 19, tzinfo=UTC)
        self.start = self.now + timedelta(hours=1)
        self.db.execute("INSERT INTO originals VALUES(?,?,?)",
                        (35, iso(self.now - timedelta(hours=8)), '{"original":true}'))
        self.original = self.db.execute("SELECT * FROM originals").fetchall()

    def ev(self, **changes):
        base = {"goalie_id": "123", "published": self.now - timedelta(minutes=5),
                "verified": self.now - timedelta(minutes=4),
                "ingested": self.now - timedelta(minutes=3)}
        base.update(changes)
        return base

    def run_refresh(self, **changes):
        args = dict(game_id=35, cutoff=self.now,
                    generated=self.now + timedelta(minutes=1),
                    start=self.start, status="scheduled", evidence=[self.ev()])
        args.update(changes)
        return refresh(self.db, **args)

    def test_valid_version_preserves_original(self):
        self.assertIsNotNone(self.run_refresh())
        self.assertEqual(self.original, self.db.execute("SELECT * FROM originals").fetchall())

    def test_late_publication_rejected(self):
        self.assertIsNone(self.run_refresh(evidence=[self.ev(published=self.now + timedelta(seconds=1))]))

    def test_late_verification_rejected(self):
        self.assertIsNone(self.run_refresh(evidence=[self.ev(verified=self.now + timedelta(seconds=1))]))

    def test_late_ingestion_rejected(self):
        self.assertIsNone(self.run_refresh(evidence=[self.ev(ingested=self.now + timedelta(seconds=1))]))

    def test_post_start_or_live_rejected(self):
        self.assertIsNone(self.run_refresh(generated=self.start))
        self.assertIsNone(self.run_refresh(status="live"))
        self.assertIsNone(self.run_refresh(status="final"))
        self.assertIsNone(self.run_refresh(status="postponed"))

    def test_unknown_time_rejected(self):
        self.assertIsNone(self.run_refresh(start=self.start.replace(tzinfo=None)))

    def test_duplicate_idempotent(self):
        first = self.run_refresh()
        self.assertEqual(first, self.run_refresh())
        self.assertEqual(1, self.db.execute("SELECT count(*) FROM versions").fetchone()[0])

    def test_new_cutoff_new_version(self):
        self.run_refresh()
        later = self.now + timedelta(minutes=10)
        self.run_refresh(cutoff=later, generated=later + timedelta(minutes=1))
        self.assertEqual(2, self.db.execute("SELECT count(*) FROM versions").fetchone()[0])

    def test_no_eligible_evidence_does_not_write(self):
        self.assertIsNone(self.run_refresh(evidence=[]))
        self.assertEqual(0, self.db.execute("SELECT count(*) FROM versions").fetchone()[0])


if __name__ == "__main__":
    unittest.main(verbosity=2)
