#!/usr/bin/env bash
# SECURITY-37: real concurrent PostgreSQL sessions in the isolated Docker database.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() { db -qAtc "DROP TABLE IF EXISTS public.security37_versions" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

db -qAtc "
CREATE TABLE public.security37_versions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 game_id bigint NOT NULL,
 cutoff_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL,
 payload jsonb NOT NULL,
 UNIQUE(game_id,cutoff_at,snapshot_hash)
);
" >/dev/null

# Every worker is an independent psql connection; workers start concurrently.
# Unique constraint + ON CONFLICT DO NOTHING must serialize conflicting inserts.
pids=()
for n in $(seq 1 12); do
  (
    db -qAtc "INSERT INTO public.security37_versions(game_id,cutoff_at,snapshot_hash,payload)
    VALUES (37,'2026-11-16 19:00:00+00','same-snapshot','{\"frozen\":true}')
    ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING;" >/dev/null
  ) &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done

rows="$(db -Atqc "SELECT count(*) FROM public.security37_versions WHERE game_id=37")"
[[ "$rows" == "1" ]] || { echo "FAIL SECURITY-37 concurrent duplicates: $rows"; exit 1; }

# Independent cutoff is a distinct append-only version.
db -qAtc "INSERT INTO public.security37_versions(game_id,cutoff_at,snapshot_hash,payload)
 VALUES (37,'2026-11-16 19:10:00+00','same-snapshot','{\"frozen\":true}')" >/dev/null
rows="$(db -Atqc "SELECT count(*) FROM public.security37_versions WHERE game_id=37")"
[[ "$rows" == "2" ]] || { echo "FAIL SECURITY-37 second cutoff: $rows"; exit 1; }
echo "PASS SECURITY-37 12 concurrent PostgreSQL sessions; one version per idempotency key"
