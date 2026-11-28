#!/usr/bin/env bash
# SECURITY-39: lost client connection before and after COMMIT, with safe retry.
# Local synthetic PostgreSQL container only. No production access.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() { db -qAtc "DROP TABLE IF EXISTS public.security39_versions" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

db -qAtc "CREATE TABLE public.security39_versions(
 game_id bigint NOT NULL, cutoff_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL, payload jsonb NOT NULL,
 UNIQUE(game_id,cutoff_at,snapshot_hash)
)" >/dev/null

# Scenario A: connection is lost while transaction is still uncommitted.
# psql receives BEGIN + INSERT, then its stdin closes without COMMIT.
# PostgreSQL must roll back the open transaction on disconnect.
printf '%s\n' "BEGIN;" \
 "INSERT INTO public.security39_versions VALUES (39,'2026-11-16 19:00+00','before-commit','{\"complete\":false}');" \
 | db -qAt >/dev/null
count="$(db -Atqc "SELECT count(*) FROM public.security39_versions WHERE snapshot_hash='before-commit'")"
[[ "$count" == "0" ]] || { echo "FAIL SECURITY-39 uncommitted disconnect persisted $count rows"; exit 1; }

# Retry after disconnect commits one complete record.
retry_sql="INSERT INTO public.security39_versions VALUES (39,'2026-11-16 19:00+00','before-commit','{\"complete\":true}') ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING;"
db -qAtc "$retry_sql" >/dev/null
db -qAtc "$retry_sql" >/dev/null
count="$(db -Atqc "SELECT count(*) FROM public.security39_versions WHERE snapshot_hash='before-commit' AND payload='{\"complete\":true}'::jsonb")"
[[ "$count" == "1" ]] || { echo "FAIL SECURITY-39 retry after rollback: $count"; exit 1; }

# Scenario B: COMMIT succeeded, but client has no acknowledgement.
# We deliberately discard the first client's output, then retry with same key.
commit_sql="INSERT INTO public.security39_versions VALUES (39,'2026-11-16 19:10+00','after-commit','{\"complete\":true}') ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING;"
db -qAtc "$commit_sql" >/dev/null
db -qAtc "$commit_sql" >/dev/null
count="$(db -Atqc "SELECT count(*) FROM public.security39_versions WHERE snapshot_hash='after-commit'")"
total="$(db -Atqc "SELECT count(*) FROM public.security39_versions WHERE game_id=39")"
[[ "$count" == "1" && "$total" == "2" ]] || { echo "FAIL SECURITY-39 ambiguous acknowledgement retry: count=$count total=$total"; exit 1; }
echo "PASS SECURITY-39 disconnect rollback and idempotent retry after unknown acknowledgement"
