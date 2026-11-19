import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/"scripts"))
from core43_cal54_sqlite_ledger import reserve_verified_manifest,seen_digests,LedgerError


class SQLiteLedgerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=str(Path(self.tmp.name)/"ledger.db")
        self.digest="a"*64
    def tearDown(self):
        self.tmp.cleanup()
    def reserve(self,**kwargs):
        p=dict(db_path=self.path,digest=self.digest,game_id=2026020335,verified=True)
        p.update(kwargs)
        return reserve_verified_manifest(**p)
    def test_first_insert(self):
        self.assertTrue(self.reserve())
    def test_duplicate_rejected(self):
        self.assertTrue(self.reserve())
        self.assertFalse(self.reserve())
    def test_persists_across_connections(self):
        self.reserve()
        self.assertIn(self.digest,seen_digests(self.path))
    def test_distinct_digest(self):
        self.reserve()
        self.assertTrue(self.reserve(digest="b"*64))
    def test_same_digest_other_game_rejected(self):
        self.reserve()
        with self.assertRaises(LedgerError):
            self.reserve(game_id=2026020336)
    def test_unverified_rejected(self):
        with self.assertRaises(LedgerError):
            self.reserve(verified=False)
    def test_export_authorization_rejected(self):
        with self.assertRaises(LedgerError):
            self.reserve(authorized_export=True)
    def test_invalid_digest(self):
        with self.assertRaises(LedgerError):
            self.reserve(digest="bad")
    def test_invalid_game(self):
        with self.assertRaises(LedgerError):
            self.reserve(game_id=0)
    def test_bool_game(self):
        with self.assertRaises(LedgerError):
            self.reserve(game_id=True)
    def test_empty_path(self):
        with self.assertRaises(LedgerError):
            self.reserve(db_path="")
    def test_missing_ledger_read_fails_closed(self):
        with self.assertRaises(LedgerError):
            seen_digests(self.path)
    def test_bad_sqlite_file(self):
        Path(self.path).write_bytes(b"not a database")
        with self.assertRaises(LedgerError):
            self.reserve()
    def test_reopen_preserves_duplicate_protection(self):
        self.reserve()
        self.assertFalse(self.reserve())

if __name__=="__main__":
    unittest.main()
