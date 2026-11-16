#!/usr/bin/env python3
"""SECURITY-08 offline guard for proposed grants SQL; NO database connection."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
PROPOSAL = ROOT / "docs/security-06-scoped-remediation-proposal.md"
PRIVATE = {
    "nhl_core43_shadow_inputs",
    "core43_shadow_readiness_v1",
    "core43_shadow_predictions_v1",
    "core43_shadow_preview_v1",
}
PRESERVE = {
    "nhl_core43_public_schedule_evidence",
    "nhl_core_model_accuracy",
    "nhl_core_model_head_to_head",
    "nhl_core_model_trend",
    "nhl_prediction_archive",
}

def proposed_sql():
    doc = PROPOSAL.read_text(encoding="utf-8")
    blocks = re.findall(r"```sql\s*(.*?)```", doc, re.S | re.I)
    if len(blocks) != 2:
        raise AssertionError("Expected exactly two SQL blocks (proposal and verification)")
    return blocks[0]

class ProposedGrantsSafety(unittest.TestCase):
    def test_explicit_transaction(self):
        sql = proposed_sql()
        self.assertRegex(sql, r"(?im)^BEGIN\s*;")
        self.assertRegex(sql, r"(?im)^COMMIT\s*;")

    def test_private_objects_are_revoked(self):
        sql = proposed_sql().lower()
        self.assertIn("revoke all on table public.nhl_core43_shadow_inputs", sql)
        for name in PRIVATE - {"nhl_core43_shadow_inputs"}:
            self.assertIn("public." + name, sql)
        self.assertRegex(sql, r"(?is)revoke\s+all\s+on\s+table\s+public\.core43_shadow_readiness_v1,.*?from\s+public,\s*anon,\s*authenticated\s*;")

    def test_no_data_changes_or_grants(self):
        sql = re.sub(r"--[^\n]*", "", proposed_sql())
        self.assertNotRegex(sql, r"(?i)\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT)\b")
        self.assertEqual(len(re.findall(r"(?i)\bREVOKE\b", sql)), 3)

    def test_public_views_not_changed(self):
        statements = re.sub(r"--[^\n]*", "", proposed_sql()).lower()
        for name in PRESERVE:
            self.assertNotIn("public." + name, statements)

    def test_never_connects_to_database(self):
        text = Path(__file__).read_text(encoding="utf-8")
        for marker in ("import psycopg", "create_client(", "os.environ["):
            self.assertNotIn(marker, text)

if __name__ == "__main__":
    unittest.main(verbosity=2)
