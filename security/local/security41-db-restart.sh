#!/usr/bin/env bash
# SECURITY-41: restart the entire isolated PostgreSQL container and verify recovery.
# Never target remote infrastructure; uses only the local Compose service.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() { db -qAtc "DROP TABLE IF EXISTS public.security41_versions" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
db -qAtc "CREATE TABLE public.security41_versions(
 game_id bigint NOT NULL, cutoff_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL, payload jsonb NOT NULL,
 UNIQUE(game_id,cutoff_at,snapshot_hash)
)" >/dev/null

# One durable committed version must survive restart.
db -qAtc "INSERT INTO public.security41_versions VALUES
 (41,'2026-11-16 19:00+00','committed','{\"complete\":true}')" >/dev/null

# Keep an uncommitted version open while restarting the local database service.
# The transaction should be aborted when PostgreSQL shuts down.
(
  db -qAtc "BEGIN;
  INSERT INTO public.security41_versions VALUES
    (41,'2026-11-16 19:10+00','uncommitted','{\"complete\":false}');
  SELECT pg_sleep(30);
  COMMIT;" >/dev/null 2>&1
) &
pending=$!
ready=0
for n in $(seq 1 100); do
  count="$(db -Atqc "SELECT count(*) FROM pg_stat_activity
    WHERE datname='security09' AND state='active'
      AND wait_event='PgSleep' AND query LIKE '%security41_versions%'")"
  if [[ "$count" == "1" ]]; then ready=1; break; fi
  sleep 0.1
done
if [[ "$ready" != "1" ]]; then
  wait "$pending" || true
  echo 'FAIL SECURITY-41 transaction did not reach restart window'
  exit 1
fi

# Restart ONLY the synthetic local Compose service, not a remote DB.
docker compose restart -t 1 postgres >/dev/null
if wait "$pending"; then
  echo 'FAIL SECURITY-41 uncommitted transaction survived restart as successful client'
  exit 1
fi
docker compose up -d --wait postgres >/dev/null

committed="$(db -Atqc "SELECT count(*) FROM public.security41_versions WHERE snapshot_hash='committed' AND payload='{\"complete\":true}'::jsonb")"
uncommitted="$(db -Atqc "SELECT count(*) FROM public.security41_versions WHERE snapshot_hash='uncommitted'")"
[[ "$committed" == "1" && "$uncommitted" == "0" ]] || {
 echo "FAIL SECURITY-41 recovery: committed=$committed uncommitted=$uncommitted"
 exit 1
}

# After recovery, retry the abandoned key twice; it must create only one complete row.
sql="INSERT INTO public.security41_versions VALUES
 (41,'2026-11-16 19:10+00','uncommitted','{\"complete\":true}')
 ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING"
db -qAtc "$sql" >/dev/null
db -qAtc "$sql" >/dev/null
total="$(db -Atqc "SELECT count(*) FROM public.security41_versions WHERE game_id=41")"
recovered="$(db -Atqc "SELECT count(*) FROM public.security41_versions WHERE snapshot_hash='uncommitted' AND payload='{\"complete\":true}'::jsonb")"
[[ "$total" == "2" && "$recovered" == "1" ]] || {
 echo "FAIL SECURITY-41 idempotent retry: total=$total recovered=$recovered"
 exit 1
}
echo 'PASS SECURITY-41 local database restart, committed durability, rollback and idempotent recovery'
