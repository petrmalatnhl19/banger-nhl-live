#!/usr/bin/env bash
# SECURITY-38: an uncommitted writer fails while a competing PostgreSQL session waits.
# Synthetic local Docker database only; no external database connections.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() { db -qAtc "DROP TABLE IF EXISTS public.security38_versions" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup
db -qAtc "CREATE TABLE public.security38_versions (
 game_id bigint NOT NULL, cutoff_at timestamptz NOT NULL, snapshot_hash text NOT NULL,
 payload jsonb NOT NULL, UNIQUE(game_id,cutoff_at,snapshot_hash)
)" >/dev/null

# First writer inserts but cannot commit; it then deliberately aborts.
# A second writer waits for the unique-key conflict to resolve.
(
  db -qAtc "
  BEGIN;
  INSERT INTO public.security38_versions VALUES
    (38,'2026-11-16 19:00+00','same','{\"complete\":false}');
  SELECT pg_sleep(4);
  SELECT 1/0;
  COMMIT;" >/dev/null 2>&1
) &
failed_writer=$!

# Confirm the first transaction is actually waiting in pg_sleep before starting
# the competitor. This avoids relying on a timing guess.
ready=0
for n in $(seq 1 40); do
  if [[ "$(db -Atqc "SELECT count(*) FROM pg_stat_activity WHERE datname='security09' AND query LIKE '%SELECT 1/0%' AND state='active' AND wait_event='PgSleep'")" -ge 1 ]]; then
    ready=1
    break
  fi
  sleep 0.1
done
if [[ "$ready" != "1" ]]; then
  wait "$failed_writer" || true
  echo 'FAIL SECURITY-38 first transaction never reached failure window'
  exit 1
fi

(
  db -qAtc "INSERT INTO public.security38_versions VALUES
    (38,'2026-11-16 19:00+00','same','{\"complete\":true}')
    ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING;" >/dev/null
) &
successful_writer=$!
if wait "$failed_writer"; then
  echo 'FAIL SECURITY-38 deliberately failing writer committed'
  wait "$successful_writer" || true
  exit 1
fi
wait "$successful_writer"

rows="$(db -Atqc "SELECT count(*) FROM public.security38_versions WHERE game_id=38 AND payload='{\"complete\":true}'::jsonb")"
total="$(db -Atqc "SELECT count(*) FROM public.security38_versions WHERE game_id=38")"
[[ "$rows" == "1" && "$total" == "1" ]] || {
  echo "FAIL SECURITY-38 incomplete/duplicate recovery rows: complete=$rows total=$total"
  exit 1
}
echo 'PASS SECURITY-38 failed transaction rolled back; competing writer committed exactly one complete version'
