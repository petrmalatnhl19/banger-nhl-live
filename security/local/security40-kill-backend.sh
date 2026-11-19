#!/usr/bin/env bash
# SECURITY-40: terminate a real PostgreSQL backend mid-transaction.
# Local synthetic Docker PostgreSQL only. No production credentials or connections.
set -euo pipefail
cd "$(dirname "$0")"
db() { docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U security_local -d security09 "$@"; }
cleanup() {
  db -qAtc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='security40_kill_target' AND pid<>pg_backend_pid()" >/dev/null 2>&1 || true
  db -qAtc "DROP TABLE IF EXISTS public.security40_versions" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup
db -qAtc "CREATE TABLE public.security40_versions(
 game_id bigint NOT NULL, cutoff_at timestamptz NOT NULL,
 snapshot_hash text NOT NULL, payload jsonb NOT NULL,
 UNIQUE(game_id,cutoff_at,snapshot_hash)
)" >/dev/null

# Session inserts an incomplete candidate, then waits in pg_sleep BEFORE COMMIT.
# Another real connection terminates its PostgreSQL backend.
(
  db -qAtc "SET application_name='security40_kill_target';
  BEGIN;
  INSERT INTO public.security40_versions VALUES
    (40,'2026-11-16 19:00+00','retry-key','{\"complete\":false}');
  SELECT pg_sleep(20);
  COMMIT;" >/dev/null 2>&1
) &
target=$!

ready=0
for n in $(seq 1 100); do
  count="$(db -Atqc "SELECT count(*) FROM pg_stat_activity
   WHERE application_name='security40_kill_target' AND state='active'
     AND wait_event='PgSleep'")"
  if [[ "$count" == "1" ]]; then ready=1; break; fi
  sleep 0.1
done
if [[ "$ready" != "1" ]]; then
  echo 'FAIL SECURITY-40 target never reached active transaction sleep'
  exit 1
fi
killed="$(db -Atqc "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
 WHERE application_name='security40_kill_target' AND pid<>pg_backend_pid()")"
[[ "$killed" == "t" ]] || { echo "FAIL SECURITY-40 backend termination failed: $killed"; exit 1; }
if wait "$target"; then
  echo 'FAIL SECURITY-40 terminated backend returned success'
  exit 1
fi
before="$(db -Atqc "SELECT count(*) FROM public.security40_versions")"
[[ "$before" == "0" ]] || { echo "FAIL SECURITY-40 uncommitted record survived: $before"; exit 1; }

# Fresh client safely retries and receives a complete immutable candidate.
sql="INSERT INTO public.security40_versions VALUES
 (40,'2026-11-16 19:00+00','retry-key','{\"complete\":true}')
 ON CONFLICT (game_id,cutoff_at,snapshot_hash) DO NOTHING"
db -qAtc "$sql" >/dev/null
db -qAtc "$sql" >/dev/null
after="$(db -Atqc "SELECT count(*) FROM public.security40_versions
 WHERE game_id=40 AND payload='{\"complete\":true}'::jsonb")"
total="$(db -Atqc "SELECT count(*) FROM public.security40_versions")"
[[ "$after" == "1" && "$total" == "1" ]] || {
  echo "FAIL SECURITY-40 retry yielded unexpected records: complete=$after total=$total"
  exit 1
}
echo 'PASS SECURITY-40 backend terminated mid-transaction; rollback and idempotent recovery'
