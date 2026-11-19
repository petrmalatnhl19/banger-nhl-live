"""CAL-47: pure offline validation for a later experimental CORE 4.3 revision.

No database, network, filesystem writes, or production model calls.
The returned record is an in-memory proposal, never an authorized CAL-07 export.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
import json


class RevisionRejected(ValueError):
    """Fail-closed when an experimental revision cannot be established."""


def utc(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise RevisionRejected("timezone_required")
    return parsed.astimezone(timezone.utc)


@dataclass(frozen=True)
class Side:
    team: str
    goalie_id: str
    evidence_status: str
    published_at: str
    verified_at: str
    gsax: str
    shots_against: int
    gsax_fetched_at: str
    snapshot_sha256: str


def propose_revision(
    *, game_id: int, away_team: str, home_team: str,
    kickoff_at: str, source_prediction_at: str, as_of: str,
    away: Side, home: Side, model_version: str,
) -> dict:
    """Validate a distinct later as-of; never rewrite the source prediction."""
    kickoff, original, revision = map(utc, (kickoff_at, source_prediction_at, as_of))
    if not (original < revision < kickoff):
        raise RevisionRejected("invalid_revision_time")
    # CAL-07 window: between 75 and 45 minutes before the scheduled start.
    remaining = (kickoff - revision).total_seconds()
    if not (45 * 60 <= remaining <= 75 * 60):
        raise RevisionRejected("outside_cal07_window")
    if game_id <= 0 or not model_version.startswith("core43-"):
        raise RevisionRejected("invalid_identity_or_model")
    if not away_team or not home_team or away_team == home_team:
        raise RevisionRejected("invalid_teams")
    sides = (("away", away_team, away), ("home", home_team, home))
    if away.goalie_id == home.goalie_id:
        raise RevisionRejected("duplicate_goalie_id")
    evidence = []
    for side_name, expected_team, side in sides:
        if side.team != expected_team or not side.goalie_id:
            raise RevisionRejected("team_or_goalie_mismatch")
        if side.evidence_status != "confirmed":
            raise RevisionRejected("starter_not_confirmed")
        published, verified, gsax_at = map(
            utc, (side.published_at, side.verified_at, side.gsax_fetched_at)
        )
        if not (published <= verified <= revision < kickoff):
            raise RevisionRejected("invalid_evidence_time")
        if not (gsax_at <= revision and gsax_at < kickoff):
            raise RevisionRejected("invalid_gsax_time")
        if side.shots_against < 30:
            raise RevisionRejected("insufficient_goalie_sample")
        try:
            value = Decimal(side.gsax)
        except Exception as exc:
            raise RevisionRejected("invalid_gsax") from exc
        if not value.is_finite():
            raise RevisionRejected("invalid_gsax")
        if len(side.snapshot_sha256) != 64 or any(
            c not in "0123456789abcdef" for c in side.snapshot_sha256
        ):
            raise RevisionRejected("invalid_snapshot_digest")
        evidence.append({
            "side": side_name, "team": expected_team, "goalie_id": side.goalie_id,
            "status": side.evidence_status, "published_at": side.published_at,
            "verified_at": side.verified_at, "gsax": str(value),
            "shots_against": side.shots_against,
            "gsax_fetched_at": side.gsax_fetched_at,
            "snapshot_sha256": side.snapshot_sha256,
        })
    payload = {
        "revision_kind": "later_pregame_experimental",
        "game_id": game_id, "away_team": away_team, "home_team": home_team,
        "kickoff_at": kickoff_at, "source_prediction_at": source_prediction_at,
        "predicted_at": as_of, "as_of": as_of,
        "model_version": model_version, "evidence": evidence,
        "authorization": "offline_proposal_only",
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    payload["proposal_sha256"] = sha256(canonical.encode("utf-8")).hexdigest()
    return payload
