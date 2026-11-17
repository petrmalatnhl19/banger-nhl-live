#!/usr/bin/env python3
"""SECURITY-68: static offline review of a scoped grant proposal. Never connects to Supabase."""
from pathlib import Path
import re

proposal = Path("docs/security-06-scoped-remediation-proposal.md").read_text()
assert "REVOKE ALL ON TABLE public.nhl_core43_shadow_inputs" in proposal
for name in ("core43_shadow_readiness_v1", "core43_shadow_predictions_v1", "core43_shadow_preview_v1"):
    assert name in proposal
assert "public.nhl_core42_status" in proposal
assert re.search(r"REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER\s+ON TABLE public.nhl_core42_status", proposal)
for public in ("nhl_core43_public_schedule_evidence", "nhl_core_model_accuracy", "nhl_core_model_head_to_head", "nhl_core_model_trend", "nhl_prediction_archive"):
    assert "public." + public in proposal
# Detect accidental grant revocation from preserved public endpoints in executable SQL blocks.
blocks = re.findall(r"```sql\s*(.*?)```", proposal, re.S | re.I)
assert blocks, "expected documented SQL proposal"
migration = blocks[0]
assert "BEGIN;" in migration and "COMMIT;" in migration
for name in ("nhl_core43_public_schedule_evidence", "nhl_core_model_accuracy", "nhl_core_model_head_to_head", "nhl_core_model_trend", "nhl_prediction_archive"):
    for statement in migration.split(";"):
        if re.search(r"\bREVOKE\b", re.sub(r"--[^\n]*", "", statement), re.I):
            assert not re.search(r"\bpublic\." + name + r"\b", re.sub(r"--[^\n]*", "", statement)), name
print("PASS SECURITY-68 scoped proposal static guard; NO production grants changed")
